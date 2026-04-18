import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, getCountFromServer } from 'firebase/firestore';
import { db, auth, signOut } from './firebase';
import { Camera, UserRole, UserStatus } from './types';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import AddCameraModal from './components/AddCameraModal';
import Auth from './components/Auth';
import AdminPanel from './components/AdminPanel';
import OverviewPanel from './components/OverviewPanel';
import ChangePassword from './components/ChangePassword';
import CompanionApp from './components/CompanionApp';
import { Shield, LogOut, Loader2, Crosshair, Users, Edit2, Clock, Trash2, CheckCircle, PanelLeftClose, PanelLeftOpen, BarChart3, Map as MapIcon, Layers, Smartphone } from 'lucide-react';
import { logEvent } from './utils/eventLogger';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [isEditingCamera, setIsEditingCamera] = useState(false);
  const [isSettingPosition, setIsSettingPosition] = useState(false);
  const [draftCameraData, setDraftCameraData] = useState<Partial<Camera> | null>(null);
  const [newCameraLocation, setNewCameraLocation] = useState<{lat: number, lng: number} | null>(null);
  const [draftDirection, setDraftDirection] = useState<number | undefined>(undefined);
  const [draftDistance, setDraftDistance] = useState<number | undefined>(undefined);
  
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [appMode, setAppMode] = useState<'registry' | 'companion'>('registry');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          
          // Use onSnapshot to listen for real-time role/status changes
          const unsubUser = onSnapshot(userRef, async (userSnap) => {
            try {
              if (userSnap.exists()) {
                const data = userSnap.data();
                setUserRole(data.role);
                setUserStatus(data.status);
                setNeedsPasswordChange(data.needsPasswordChange === true);
              } else {
                // Create user document if it doesn't exist
                if (currentUser.email === 'nathan.tracey@sussex.police.uk') {
                  await setDoc(userRef, {
                    email: currentUser.email,
                    role: 'admin',
                    status: 'approved',
                    createdAt: serverTimestamp()
                  });
                  setUserRole('admin');
                  setUserStatus('approved');
                } else {
                  await setDoc(userRef, {
                    email: currentUser.email,
                    role: 'viewer',
                    status: 'pending',
                    createdAt: serverTimestamp()
                  });
                  setUserRole('viewer');
                  setUserStatus('pending');
                }
              }
              setAuthLoading(false);
            } catch (innerErr: any) {
              console.error("Error setting up user doc:", innerErr);
              setError(`Failed to set up user document. Error: ${innerErr.message || 'Unknown'}`);
              setAuthLoading(false);
            }
          }, (err: any) => {
            console.error("Error listening to user doc:", err);
            if (err.code === 'unavailable') {
              setError("Network error: Could not reach the server. Please check your connection.");
            } else if (err.code === 'permission-denied') {
              setError("Permission denied: Your account lacks access, or rules are still updating.");
            } else {
              setError(`Failed to verify user permissions. Error: ${err.message || 'Unknown'}`);
            }
            setAuthLoading(false);
          });
          
          return () => unsubUser();
        } catch (err: any) {
          console.error("Error setting up user:", err);
          setError(`Failed to set up user. Error: ${err.message || 'Unknown'}`);
          setAuthLoading(false);
        }
      } else {
        setUserRole(null);
        setUserStatus(null);
        setNeedsPasswordChange(false);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !userRole || userStatus !== 'approved' || needsPasswordChange) return;

    const q = query(collection(db, 'cameras'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cameraData: Camera[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type !== 'doorbell') {
          cameraData.push({ id: doc.id, ...data } as Camera);
        }
      });
      setCameras(cameraData);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'cameras');
      } catch (e: any) {
        setError(e.message);
      }
    });

    return () => unsubscribe();
  }, [user, userRole, userStatus, needsPasswordChange]);

  useEffect(() => {
    if (userRole !== 'admin') return;
    
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let pendingCount = 0;
      let totalCount = 0;
      snapshot.forEach(doc => {
        totalCount++;
        if (doc.data().status === 'pending') pendingCount++;
      });
      setPendingUsersCount(pendingCount);
      setUsersCount(totalCount);
    });
    return () => unsubscribe();
  }, [userRole]);

  const handleSaveCamera = async (cameraData: Partial<Camera>) => {
    if (!user) return;
    
    try {
      if (isEditingCamera && selectedCamera) {
        const updatePayload: any = {
          ...cameraData,
          updatedAt: serverTimestamp()
        };
        
        // Add creatorEmail for legacy cameras that don't have it
        if (!selectedCamera.creatorEmail && user.email) {
          updatePayload.creatorEmail = user.email;
        }
        if (!selectedCamera.createdAt) {
          updatePayload.createdAt = serverTimestamp();
        }
        if (!selectedCamera.addedBy) {
          updatePayload.addedBy = user.uid;
        }

        // Ensure optional fields are not undefined (Firestore throws on undefined)
        // If they are undefined, we use deleteField() to remove them
        const optionalFields = ['direction', 'fieldOfView', 'viewDistance', 'ownerName', 'policeReferenceNumber', 'name', 'address'] as const;
        optionalFields.forEach(field => {
          if (updatePayload[field] === undefined) {
            updatePayload[field] = deleteField();
          }
        });

        // Clean up legacy fields if they exist on the document
        const legacyFields = ['notes', 'contactNumber', 'referenceNumber', 'contactDetails'];
        legacyFields.forEach(field => {
          if ((selectedCamera as any)[field] !== undefined) {
            updatePayload[field] = deleteField();
          }
        });

        await updateDoc(doc(db, 'cameras', selectedCamera.id), updatePayload);
        const ownerName = cameraData.ownerName || selectedCamera.ownerName || 'Unknown';
        const lat = cameraData.latitude || selectedCamera.latitude;
        const lng = cameraData.longitude || selectedCamera.longitude;
        const cameraName = cameraData.name || selectedCamera.name || `${ownerName}/${lat.toFixed(6)}&${lng.toFixed(6)}`;
        await logEvent('camera_amended', user.uid, user.email || '', `Amended camera ${cameraName}`);
        setIsEditingCamera(false);
      } else {
        const createPayload: any = {
          ...cameraData,
          addedBy: user.uid,
          creatorEmail: user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const optionalFields = ['direction', 'fieldOfView', 'viewDistance', 'ownerName', 'policeReferenceNumber', 'name', 'address'] as const;
        optionalFields.forEach(field => {
          if (createPayload[field] === undefined) {
            delete createPayload[field];
          }
        });

        const docRef = await addDoc(collection(db, 'cameras'), createPayload);
        const ownerName = cameraData.ownerName || 'Unknown';
        const lat = cameraData.latitude!;
        const lng = cameraData.longitude!;
        const cameraName = cameraData.name || `${ownerName}/${lat.toFixed(6)}&${lng.toFixed(6)}`;
        await logEvent('camera_added', user.uid, user.email || '', `Added camera ${cameraName}`);
        setNewCameraLocation(null);
        setIsAddingCamera(false);
      }
      setDraftDirection(undefined);
      setDraftDistance(undefined);
    } catch (error) {
      handleFirestoreError(error, isEditingCamera ? OperationType.UPDATE : OperationType.CREATE, 'cameras');
    }
  };

  const handleDeleteCamera = async () => {
    if (!user || !selectedCamera) return;
    if (!window.confirm('Are you sure you want to delete this camera? This action cannot be undone.')) return;
    
    try {
      await deleteDoc(doc(db, 'cameras', selectedCamera.id));
      const ownerName = selectedCamera.ownerName || 'Unknown';
      const lat = selectedCamera.latitude;
      const lng = selectedCamera.longitude;
      const cameraName = selectedCamera.name || `${ownerName}/${lat.toFixed(6)}&${lng.toFixed(6)}`;
      await logEvent('camera_removed', user.uid, user.email || '', `Deleted camera ${cameraName}`);
      setSelectedCamera(null);
      setIsEditingCamera(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'cameras');
    }
  };

  const handleVerifyCamera = async () => {
    if (!user || !selectedCamera) return;
    
    try {
      const updatePayload: any = {
        lastVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Add creatorEmail for legacy cameras that don't have it
      if (!selectedCamera.creatorEmail && user.email) {
        updatePayload.creatorEmail = user.email;
      }
      if (!selectedCamera.createdAt) {
        updatePayload.createdAt = serverTimestamp();
      }
      if (!selectedCamera.addedBy) {
        updatePayload.addedBy = user.uid;
      }

      // Clean up legacy string values for numbers
      if (typeof selectedCamera.direction === 'string') {
        updatePayload.direction = selectedCamera.direction === '' ? deleteField() : Number(selectedCamera.direction);
      }
      if (typeof selectedCamera.fieldOfView === 'string') {
        updatePayload.fieldOfView = selectedCamera.fieldOfView === '' ? deleteField() : Number(selectedCamera.fieldOfView);
      }
      if (typeof selectedCamera.viewDistance === 'string') {
        updatePayload.viewDistance = selectedCamera.viewDistance === '' ? deleteField() : Number(selectedCamera.viewDistance);
      }

      // Clean up legacy fields if they exist on the document
      const legacyFields = ['notes', 'contactNumber', 'referenceNumber', 'contactDetails'];
      legacyFields.forEach(field => {
        if ((selectedCamera as any)[field] !== undefined) {
          updatePayload[field] = deleteField();
        }
      });

      await updateDoc(doc(db, 'cameras', selectedCamera.id), updatePayload);
      const ownerName = selectedCamera.ownerName || 'Unknown';
      const lat = selectedCamera.latitude;
      const lng = selectedCamera.longitude;
      const cameraName = selectedCamera.name || `${ownerName}/${lat.toFixed(6)}&${lng.toFixed(6)}`;
      await logEvent('camera_amended', user.uid, user.email || '', `Verified camera ${cameraName} as active`);
      setIsEditingCamera(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'cameras');
    }
  };

  const handleLogout = async () => {
    if (user) {
      await logEvent('logout', user.uid, user.email || '', 'User logged out');
    }
    signOut(auth);
  };

  const handleEditClick = () => {
    if (!selectedCamera) return;
    setIsEditingCamera(true);
    setDraftDirection(selectedCamera.direction !== undefined ? selectedCamera.direction : 0);
    setDraftDistance(selectedCamera.viewDistance !== undefined ? selectedCamera.viewDistance : 30);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading Sussex Camera Registry...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (needsPasswordChange) {
    return <ChangePassword onComplete={() => setNeedsPasswordChange(false)} />;
  }

  if (userStatus === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center border-t-4 border-amber-500">
          <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
            <Clock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
          <p className="text-gray-600 mb-8">
            Your account has been created but requires administrator approval before you can access the Sussex Camera Registry.
          </p>
          <button 
            onClick={() => signOut(auth)}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const canEdit = selectedCamera && (userRole === 'admin' || userRole === 'user');
  const canAdd = userRole === 'admin' || userRole === 'user';

  if (appMode === 'companion' && user) {
    return (
      <CompanionApp 
        user={user} 
        cameras={cameras}
        onSwitchMode={() => setAppMode('registry')} 
        onLogout={handleLogout} 
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-10"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <div className={`absolute md:relative z-20 h-full transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'}`}>
        <Sidebar 
          cameras={cameras} 
          onSelectCamera={(cam) => {
            setSelectedCamera(cam);
            setFocusTrigger(prev => prev + 1);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }} 
          onAddCameraClick={() => {
            if (!canAdd) return;
            setIsAddingCamera(true);
            setSelectedCamera(null);
            setDraftDirection(undefined);
            setDraftDistance(undefined);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          selectedCameraId={selectedCamera?.id}
          onLocationFound={(lat, lng) => {
            setMapCenter([lat, lng]);
            setSelectedCamera(null);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          canAdd={canAdd}
        />
      </div>
      
      <div className="flex-1 relative flex flex-col min-w-0">
        <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shadow-sm z-10">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar flex-1">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md md:hidden"
            >
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-2 text-gray-600 hover:bg-gray-100 rounded-md"
              title="Toggle Sidebar"
            >
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            
            {isAddingCamera && (
              <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium border border-amber-200 whitespace-nowrap">
                <Crosshair size={16} />
                <span className="hidden sm:inline">Select location on map</span>
                <span className="sm:hidden">Select location</span>
                <button 
                  onClick={() => {
                    setIsAddingCamera(false);
                    setNewCameraLocation(null);
                    setDraftDirection(undefined);
                    setDraftDistance(undefined);
                  }}
                  className="ml-2 text-amber-600 hover:text-amber-900 underline"
                >
                  Cancel
                </button>
              </div>
            )}
            {selectedCamera && !isEditingCamera && canEdit && (
              <>
                <button
                  onClick={handleEditClick}
                  className="flex items-center gap-1 sm:gap-2 bg-blue-100 text-blue-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border border-blue-200 hover:bg-blue-200 transition-colors whitespace-nowrap"
                >
                  <Edit2 size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Amend</span>
                </button>
              </>
            )}
            {userRole === 'admin' && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium border border-purple-200 hover:bg-purple-200 transition-colors relative whitespace-nowrap"
              >
                <Users size={16} />
                <span className="hidden sm:inline">Admin</span>
                {pendingUsersCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {pendingUsersCount}
                  </span>
                )}
              </button>
            )}
            
            <button
              onClick={() => setShowOverview(true)}
              className="flex items-center gap-2 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium border border-indigo-200 hover:bg-indigo-200 transition-colors whitespace-nowrap"
            >
              <BarChart3 size={16} />
              <span className="hidden sm:inline">Overview</span>
            </button>
            
            <div className="flex items-center gap-2 ml-2 border-l border-gray-200 pl-2 sm:pl-4">
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${showHeatmap ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
                title="Toggle Heatmap"
              >
                <MapIcon size={16} />
                <span>Heatmap</span>
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 ml-2 flex-shrink-0">
            <button
              onClick={() => setAppMode('companion')}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-md hover:bg-blue-700 transition-colors whitespace-nowrap"
              title="Quick Add Companion"
            >
              <Smartphone size={16} />
              <span className="hidden sm:inline">Quick Add</span>
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
              <p className="text-xs text-gray-500 capitalize">{userRole} Access</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 relative">
          <MapComponent 
            cameras={cameras}
            selectedCamera={selectedCamera}
            onSelectCamera={(cam) => {
              setSelectedCamera(cam);
              setFocusTrigger(prev => prev + 1);
            }}
            isAddingCamera={isAddingCamera || isSettingPosition}
            mapCenter={mapCenter}
            focusTrigger={focusTrigger}
            showHeatmap={showHeatmap}
            onEditCamera={(camera) => {
              setSelectedCamera(camera);
              setIsEditingCamera(true);
              setDraftDirection(camera.direction !== undefined ? camera.direction : 0);
              setDraftDistance(camera.viewDistance !== undefined ? camera.viewDistance : 30);
            }}
            canEditCamera={(camera) => userRole === 'admin' || userRole === 'user'}
            onMapClick={(lat, lng) => {
              if (isAddingCamera || isSettingPosition) {
                setNewCameraLocation({ lat, lng });
                if (draftDirection === undefined) {
                  setDraftDirection(0);
                }
              }
            }}
            draftCamera={(newCameraLocation || isEditingCamera) ? {
              lat: newCameraLocation?.lat || selectedCamera!.latitude,
              lng: newCameraLocation?.lng || selectedCamera!.longitude,
              direction: draftDirection !== undefined ? draftDirection : 0,
              fieldOfView: draftCameraData?.fieldOfView || (isEditingCamera ? selectedCamera?.fieldOfView : 90),
              viewDistance: draftDistance !== undefined ? draftDistance : (isEditingCamera ? selectedCamera?.viewDistance : 30),
              type: draftCameraData?.type || (isEditingCamera ? selectedCamera!.type : 'cctv')
            } : null}
            onDraftDirectionChange={(dir, dist, fov) => {
              setDraftDirection(dir);
              if (dist !== undefined) setDraftDistance(dist);
              if (fov !== undefined) {
                setDraftCameraData(prev => prev ? { ...prev, fieldOfView: fov } : null);
              }
            }}
          />
          
          {isSettingPosition && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000]">
              <button
                onClick={() => setIsSettingPosition(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 transition-transform hover:scale-105"
              >
                <Crosshair size={20} />
                Confirm Position
              </button>
            </div>
          )}
        </main>
      </div>

      {(newCameraLocation || isEditingCamera) && !isSettingPosition && (
        <AddCameraModal 
          lat={newCameraLocation?.lat || selectedCamera!.latitude}
          lng={newCameraLocation?.lng || selectedCamera!.longitude}
          initialData={draftCameraData as Camera || (isEditingCamera ? selectedCamera : null)}
          draftDirection={draftDirection}
          draftDistance={draftDistance}
          onDirectionChange={setDraftDirection}
          onSetPosition={(currentData) => {
            setDraftCameraData(currentData);
            setIsSettingPosition(true);
          }}
          onClose={() => {
            setNewCameraLocation(null);
            setIsAddingCamera(false);
            setIsEditingCamera(false);
            setDraftDirection(undefined);
            setDraftDistance(undefined);
            setDraftCameraData(null);
            setIsSettingPosition(false);
          }}
          onSave={handleSaveCamera}
          onDelete={handleDeleteCamera}
          onVerify={handleVerifyCamera}
        />
      )}

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {showOverview && (
        <OverviewPanel 
          cameras={cameras} 
          usersCount={usersCount} 
          onClose={() => setShowOverview(false)} 
        />
      )}
      
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg max-w-md z-[3000]">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold">Error</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <Shield size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
