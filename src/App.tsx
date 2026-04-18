import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera } from './types';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import AddCameraModal from './components/AddCameraModal';
import Auth from './components/Auth';
import AdminPanel from './components/AdminPanel';
import OverviewPanel from './components/OverviewPanel';
import CompanionApp from './components/CompanionApp';
import {
  Shield,
  LogOut,
  Loader2,
  Crosshair,
  Users,
  Edit2,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  Map as MapIcon,
  Smartphone,
} from 'lucide-react';
import { api, getCachedUser, getToken, setSession } from './services/api';
import { subscribeCameras } from './services/realtime';
import type { CurrentUser } from './services/api';

type DraftCameraState = Partial<Camera> | null;

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(() => getCachedUser());
  const [authLoading, setAuthLoading] = useState<boolean>(Boolean(getToken()));
  const [error, setError] = useState<string | null>(null);

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [isEditingCamera, setIsEditingCamera] = useState(false);
  const [isSettingPosition, setIsSettingPosition] = useState(false);
  const [draftCameraData, setDraftCameraData] = useState<DraftCameraState>(null);
  const [newCameraLocation, setNewCameraLocation] =
    useState<{ lat: number; lng: number } | null>(null);
  const [draftDirection, setDraftDirection] = useState<number | undefined>(undefined);
  const [draftDistance, setDraftDistance] = useState<number | undefined>(undefined);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [appMode, setAppMode] = useState<'registry' | 'companion'>('registry');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [focusTrigger, setFocusTrigger] = useState(0);

  // Validate cached token on mount.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setSession(token, me);
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null, null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset local state on session expiry pushed from the API layer.
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setCameras([]);
      setSelectedCamera(null);
      setError('Your session has expired. Please sign in again.');
    };
    window.addEventListener('suspol:session-expired', handler);
    return () => window.removeEventListener('suspol:session-expired', handler);
  }, []);

  const isApproved = user?.status === 'approved';

  // Camera realtime subscription (approved users only).
  useEffect(() => {
    if (!user || !isApproved) return;
    let unsub: (() => void) | null = null;
    api
      .listCameras()
      .then((initial) => setCameras(initial))
      .catch((e: Error) => setError(e.message));
    unsub = subscribeCameras(
      (ev) => {
        if (ev.type === 'snapshot') {
          setCameras(ev.cameras);
        } else if (ev.type === 'upsert') {
          setCameras((prev) => {
            const i = prev.findIndex((c) => c.id === ev.camera.id);
            if (i === -1) return [...prev, ev.camera];
            const next = prev.slice();
            next[i] = ev.camera;
            return next;
          });
        } else if (ev.type === 'delete') {
          setCameras((prev) => prev.filter((c) => c.id !== ev.id));
          setSelectedCamera((cur) => (cur && cur.id === ev.id ? null : cur));
        }
      },
      (msg) => setError(msg),
    );
    return () => {
      unsub?.();
    };
  }, [user, isApproved]);

  // Admin-only user stats.
  useEffect(() => {
    if (user?.role !== 'admin') return;
    let cancelled = false;
    const load = () => {
      api
        .listUsers()
        .then((all) => {
          if (cancelled) return;
          setUsersCount(all.length);
          setPendingUsersCount(all.filter((u) => u.status === 'pending').length);
        })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user?.role, showAdminPanel]);

  const handleSaveCamera = useCallback(
    async (cameraData: Partial<Camera>) => {
      if (!user) return;
      try {
        if (isEditingCamera && selectedCamera) {
          const updated = await api.updateCamera(selectedCamera.id, cameraData);
          setSelectedCamera(updated);
          setIsEditingCamera(false);
        } else {
          await api.createCamera(cameraData);
          setNewCameraLocation(null);
          setIsAddingCamera(false);
        }
        setDraftDirection(undefined);
        setDraftDistance(undefined);
        setDraftCameraData(null);
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [user, isEditingCamera, selectedCamera],
  );

  const handleDeleteCamera = useCallback(async () => {
    if (!user || !selectedCamera) return;
    if (
      !window.confirm(
        'Are you sure you want to delete this camera? This action cannot be undone.',
      )
    )
      return;
    try {
      await api.deleteCamera(selectedCamera.id);
      setSelectedCamera(null);
      setIsEditingCamera(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [user, selectedCamera]);

  const handleVerifyCamera = useCallback(async () => {
    if (!user || !selectedCamera) return;
    try {
      const updated = await api.verifyCamera(selectedCamera.id);
      setSelectedCamera(updated);
      setIsEditingCamera(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [user, selectedCamera]);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore; session is being cleared locally either way */
    }
    setSession(null, null);
    setUser(null);
    setCameras([]);
    setSelectedCamera(null);
  }, []);

  const handleEditClick = () => {
    if (!selectedCamera) return;
    setIsEditingCamera(true);
    setDraftDirection(selectedCamera.direction ?? 0);
    setDraftDistance(selectedCamera.viewDistance ?? 30);
  };

  const handleLoginSuccess = useCallback((nextUser: CurrentUser) => {
    setUser(nextUser);
    setError(null);
  }, []);

  const canEdit = Boolean(
    selectedCamera && user && (user.role === 'admin' || user.role === 'user'),
  );
  const canAdd = user?.role === 'admin' || user?.role === 'user';

  const draftOrigin = useMemo(() => {
    if (newCameraLocation) {
      return { lat: newCameraLocation.lat, lng: newCameraLocation.lng };
    }
    if (isEditingCamera && selectedCamera) {
      return { lat: selectedCamera.latitude, lng: selectedCamera.longitude };
    }
    return null;
  }, [newCameraLocation, isEditingCamera, selectedCamera]);

  const draftCamera = useMemo(() => {
    if (!draftOrigin) return null;
    return {
      lat: draftOrigin.lat,
      lng: draftOrigin.lng,
      direction: draftDirection !== undefined ? draftDirection : 0,
      fieldOfView:
        draftCameraData?.fieldOfView ??
        (isEditingCamera && selectedCamera ? selectedCamera.fieldOfView ?? 90 : 90),
      viewDistance:
        draftDistance ??
        (isEditingCamera && selectedCamera
          ? selectedCamera.viewDistance ?? 30
          : 30),
      type:
        (draftCameraData?.type as string | undefined) ??
        (isEditingCamera && selectedCamera ? selectedCamera.type : 'cctv'),
    };
  }, [
    draftOrigin,
    draftDirection,
    draftDistance,
    draftCameraData,
    isEditingCamera,
    selectedCamera,
  ]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading Sussex Camera Registry…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onSuccess={handleLoginSuccess} />;
  }

  if (user.status === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center border-t-4 border-amber-500">
          <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
            <Clock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
          <p className="text-gray-600 mb-8">
            Your account has been created but requires administrator approval before
            you can access the Sussex Camera Registry.
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (appMode === 'companion') {
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

      <div
        className={`absolute md:relative z-20 h-full transition-transform duration-300 ${
          isSidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'
        }`}
      >
        <Sidebar
          cameras={cameras}
          onSelectCamera={(cam) => {
            setSelectedCamera(cam);
            setFocusTrigger((prev) => prev + 1);
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
              aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-2 text-gray-600 hover:bg-gray-100 rounded-md"
              aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
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
              <button
                onClick={handleEditClick}
                className="flex items-center gap-1 sm:gap-2 bg-blue-100 text-blue-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border border-blue-200 hover:bg-blue-200 transition-colors whitespace-nowrap"
              >
                <Edit2 size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Amend</span>
              </button>
            )}
            {user.role === 'admin' && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium border border-purple-200 hover:bg-purple-200 transition-colors relative whitespace-nowrap"
              >
                <Users size={16} />
                <span className="hidden sm:inline">Admin</span>
                {pendingUsersCount > 0 && (
                  <span
                    className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full"
                    aria-label={`${pendingUsersCount} pending users`}
                  >
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
                aria-pressed={showHeatmap}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                  showHeatmap
                    ? 'bg-orange-100 text-orange-800 border-orange-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                }`}
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
              <p className="text-xs text-gray-500 capitalize">{user.role} Access</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Sign Out"
              aria-label="Sign out"
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
              setFocusTrigger((prev) => prev + 1);
            }}
            isAddingCamera={isAddingCamera || isSettingPosition}
            mapCenter={mapCenter}
            focusTrigger={focusTrigger}
            showHeatmap={showHeatmap}
            onEditCamera={(camera) => {
              setSelectedCamera(camera);
              setIsEditingCamera(true);
              setDraftDirection(camera.direction ?? 0);
              setDraftDistance(camera.viewDistance ?? 30);
            }}
            canEditCamera={() => user.role === 'admin' || user.role === 'user'}
            onMapClick={(lat, lng) => {
              if (isAddingCamera || isSettingPosition) {
                setNewCameraLocation({ lat, lng });
                if (draftDirection === undefined) {
                  setDraftDirection(0);
                }
              }
            }}
            draftCamera={draftCamera}
            onDraftDirectionChange={(dir, dist, fov) => {
              setDraftDirection(dir);
              if (dist !== undefined) setDraftDistance(dist);
              if (fov !== undefined) {
                setDraftCameraData((prev) => ({ ...(prev ?? {}), fieldOfView: fov }));
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

      {draftOrigin && !isSettingPosition && (
        <AddCameraModal
          lat={draftOrigin.lat}
          lng={draftOrigin.lng}
          initialData={
            (draftCameraData as Camera | null) ??
            (isEditingCamera ? selectedCamera : null)
          }
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

      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}

      {showOverview && (
        <OverviewPanel
          cameras={cameras}
          usersCount={usersCount}
          onClose={() => setShowOverview(false)}
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg max-w-md z-[3000]"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold">Error</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
              aria-label="Dismiss error"
            >
              <Shield size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
