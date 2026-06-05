import React, { useState, useEffect } from 'react';
import { secondaryAuth, createUserWithEmailAndPassword, db, auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { User, UserRole, UserStatus, EventLog, Camera } from '../types';
import { X, UserPlus, Loader2, CheckCircle, Trash2, ShieldAlert, Activity, Key, Clock, RotateCcw, Copy, Download, Check, Users, Compass, AlertTriangle, MapPin, Sliders, RefreshCw, Save } from 'lucide-react';
import { logEvent } from '../utils/eventLogger';

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'add' | 'bulk_add' | 'logs' | 'archive' | 'audit'>('users');
  const [archivedCameras, setArchivedCameras] = useState<any[]>([]);

  // States for Audit & Position Integrity Checks
  const [auditCameras, setAuditCameras] = useState<Camera[]>([]);
  const [savingCameraId, setSavingCameraId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [editingCameraFields, setEditingCameraFields] = useState<{
    [id: string]: {
      latitude: string;
      longitude: string;
      fieldOfView: string;
      direction: string;
    }
  }>({});

  // States for bulk user creation
  const [bulkEmailsText, setBulkEmailsText] = useState('');
  const [bulkRole, setBulkRole] = useState<UserRole>('user');
  const [bulkUsersList, setBulkUsersList] = useState<{
    email: string;
    password: string;
    status: 'pending' | 'creating' | 'success' | 'failed';
    error?: string;
  }[]>([]);
  const [bulkInProgress, setBulkInProgress] = useState(false);
  const [bulkCopiedIndex, setBulkCopiedIndex] = useState<number | null>(null);
  const [bulkCopiedAll, setBulkCopiedAll] = useState(false);

  const generateQuickPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz';
    const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const specials = '!@#$%^&*';
    
    let pass = '';
    pass += uppercase[Math.floor(Math.random() * uppercase.length)];
    pass += chars[Math.floor(Math.random() * chars.length)];
    pass += numbers[Math.floor(Math.random() * numbers.length)];
    pass += specials[Math.floor(Math.random() * specials.length)];
    
    const allChars = chars + uppercase + numbers + specials;
    for (let i = 0; i < 6; i++) {
      pass += allChars[Math.floor(Math.random() * allChars.length)];
    }
    return pass;
  };

  useEffect(() => {
    if (activeTab !== 'archive') return;
    const q = query(collection(db, 'archived_cameras'), orderBy('deletedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const archiveData: any[] = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : null;
        
        // Auto-cleanup if expired by more than 30 days
        if (expiresAt && expiresAt.getTime() < now) {
          deleteDoc(doc(db, 'archived_cameras', docSnap.id)).catch(console.error);
        } else {
          archiveData.push({ id: docSnap.id, ...data });
        }
      });
      setArchivedCameras(archiveData);
    });
    return () => unsubscribe();
  }, [activeTab]);

  const handleRestoreCamera = async (archivedCam: any) => {
    try {
      setError('');
      setSuccess('');
      // Create original camera record
      await setDoc(doc(db, 'cameras', archivedCam.originalId), {
        ...archivedCam.originalCamera,
        updatedAt: serverTimestamp()
      });
      
      // Delete archive backup record
      await deleteDoc(doc(db, 'archived_cameras', archivedCam.id));
      
      // Log event
      const cameraName = archivedCam.originalCamera.name || `${archivedCam.originalCamera.type}/${archivedCam.originalCamera.latitude.toFixed(6)}&${archivedCam.originalCamera.longitude.toFixed(6)}`;
      await logEvent('camera_added', auth.currentUser?.uid || 'admin', auth.currentUser?.email || '', `Restored camera ${cameraName} from archive`);
      
      setSuccess(`Camera "${cameraName}" successfully restored to registry.`);
    } catch (err: any) {
      setError(err.message || 'Failed to restore camera');
    }
  };

  const handlePermanentDelete = async (archivedCam: any) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete camera "${archivedCam.originalCamera.name || 'this camera'}"? This action is IRREVERSIBLE and bypasses the 30-day recovery safety net.`)) return;
    try {
      setError('');
      setSuccess('');
      await deleteDoc(doc(db, 'archived_cameras', archivedCam.id));
      
      const cameraName = archivedCam.originalCamera.name || `${archivedCam.originalCamera.type}/${archivedCam.originalCamera.latitude.toFixed(6)}&${archivedCam.originalCamera.longitude.toFixed(6)}`;
      await logEvent('camera_removed', auth.currentUser?.uid || 'admin', auth.currentUser?.email || '', `Permanently deleted camera ${cameraName} from archive`);
      
      setSuccess(`Camera "${cameraName}" has been permanently deleted from storage.`);
    } catch (err: any) {
      setError(err.message || 'Failed to permanently delete camera');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as User);
      });
      setUsers(usersData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab !== 'logs') return;
    const q = query(collection(db, 'events'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData: EventLog[] = [];
      snapshot.forEach((doc) => {
        eventsData.push({ id: doc.id, ...doc.data() } as EventLog);
      });
      setEvents(eventsData);
    });
    return () => unsubscribe();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    const q = query(collection(db, 'cameras'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cams: Camera[] = [];
      snapshot.forEach((docSnap) => {
        cams.push({ id: docSnap.id, ...docSnap.data() } as Camera);
      });
      setAuditCameras(cams);
      
      // Initialize/Update editing helper state
      setEditingCameraFields(prev => {
        const updated = { ...prev };
        cams.forEach(cam => {
          if (!updated[cam.id]) {
            updated[cam.id] = {
              latitude: cam.latitude.toString(),
              longitude: cam.longitude.toString(),
              fieldOfView: (cam.fieldOfView ?? 90).toString(),
              direction: (cam.direction ?? 0).toString()
            };
          }
        });
        return updated;
      });
    });
    return () => unsubscribe();
  }, [activeTab]);

  const handleSaveAuditCamera = async (camId: string) => {
    const fields = editingCameraFields[camId];
    if (!fields) return;
    
    setSavingCameraId(camId);
    setError('');
    setSuccess('');
    
    try {
      const prevCam = auditCameras.find(c => c.id === camId);
      const lat = Number(fields.latitude);
      const lng = Number(fields.longitude);
      const fov = fields.fieldOfView === '' ? 90 : Number(fields.fieldOfView);
      const dir = fields.direction === '' ? 0 : Number(fields.direction);
      
      if (isNaN(lat) || isNaN(lng) || isNaN(fov) || isNaN(dir)) {
        throw new Error('Please input valid numeric values.');
      }
      
      await updateDoc(doc(db, 'cameras', camId), {
        latitude: lat,
        longitude: lng,
        fieldOfView: fov,
        direction: dir,
        updatedAt: serverTimestamp()
      });
      
      await logEvent(
        'camera_amended', 
        auth.currentUser?.uid || 'admin', 
        auth.currentUser?.email || '', 
        `Audited and updated camera ${prevCam?.name || camId} alignment parameters: [Lat: ${lat}, Lng: ${lng}, FOV: ${fov}°, Dir: ${dir}°]`
      );
      
      setSuccess(`Updated camera settings successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update camera');
    } finally {
      setSavingCameraId(null);
    }
  };

  const handleBulkMoveSeaCameras = async () => {
    const seaCams = auditCameras.filter(c => c.latitude < 50.8080);
    if (seaCams.length === 0) {
      setSuccess('All cameras are safely located on land!');
      setTimeout(() => setSuccess(''), 3005);
      return;
    }
    
    if (!window.confirm(`Are you sure you want to shift ${seaCams.length} marine cameras northwards onto the shoreline promenade (Lat: 50.8100)?`)) return;
    
    setBulkActionLoading(true);
    setError('');
    setSuccess('');
    let modified = 0;
    
    try {
      for (const cam of seaCams) {
        await updateDoc(doc(db, 'cameras', cam.id), {
          latitude: 50.8100, // Move onto high-dry Worthing pavement
          updatedAt: serverTimestamp()
        });
        modified++;
      }
      
      await logEvent(
        'camera_amended', 
        auth.currentUser?.uid || 'admin', 
        auth.currentUser?.email || '', 
        `Bulk relocated ${modified} marine boundary cameras out of Worthing sea and onto the Sussex mainland shoreline (lat: 50.8100)`
      );
      
      setSuccess(`Successfully shifted ${modified} cameras out of the sea onto mainland Worthing (Lat: 50.8100).`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Error occurred during bulk coordinate alignment');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkFOVDiverse = async () => {
    const defaultFovCams = auditCameras.filter(c => c.fieldOfView === 90 || c.fieldOfView === undefined);
    if (defaultFovCams.length === 0) {
      setSuccess('All cameras already have customized FOVs!');
      setTimeout(() => setSuccess(''), 3005);
      return;
    }
    
    if (!window.confirm(`Are you sure you want to assign optimized fields of view to the ${defaultFovCams.length} cameras currently locked to default 90°?`)) return;
    
    setBulkActionLoading(true);
    setError('');
    setSuccess('');
    let updatedCount = 0;
    
    try {
      for (const cam of defaultFovCams) {
        let optimalFov = 90;
        if (cam.type === 'cctv') optimalFov = 75;         // standard retail cctv
        else if (cam.type === 'pfs') optimalFov = 110;    // wide driveway monitoring
        else if (cam.type === 'police_council') optimalFov = 85; // focused high-street dome
        else optimalFov = 80;                             // other properties
        
        await updateDoc(doc(db, 'cameras', cam.id), {
          fieldOfView: optimalFov,
          updatedAt: serverTimestamp()
        });
        updatedCount++;
      }
      
      await logEvent(
        'camera_amended', 
        auth.currentUser?.uid || 'admin', 
        auth.currentUser?.email || '', 
        `Batch randomized and distributed realistic fields of view across ${updatedCount} legacy/default 90° sensors`
      );
      
      setSuccess(`Calibrated fields of view across ${updatedCount} cameras using type-specific lens profiles!`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Error occurred during batch FOV optimizer');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const defaultPassword = 'Admin123!';
      // Create user in secondary auth instance to avoid logging out current admin
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, defaultPassword);
      const newUserId = userCredential.user.uid;

      // Create user document in Firestore
      await setDoc(doc(db, 'users', newUserId), {
        email,
        role,
        status: 'approved',
        needsPasswordChange: true,
        createdAt: serverTimestamp()
      });

      // Sign out of secondary auth just to be clean
      await secondaryAuth.signOut();

      setSuccess(`User ${email} created successfully. They must log in with password 'Admin123!' and change it.`);
      setEmail('');
      setRole('user');
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAddUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkInProgress) return;
    setError('');
    setSuccess('');
    
    // Parse raw input by split on common delimiters (newlines, commas, semicolons, etc)
    const rawEmails = bulkEmailsText
      .split(/[\n,;\s]+/)
      .map(em => em.trim())
      .filter(Boolean);
      
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validatedEntries = rawEmails.map(emStr => {
      const isValid = emailRegex.test(emStr);
      return {
        email: emStr,
        password: generateQuickPassword(),
        status: (isValid ? 'pending' : 'failed') as 'pending' | 'failed',
        error: isValid ? undefined : 'Invalid email format'
      };
    });
    
    if (validatedEntries.length === 0) {
      setError('Please input at least one valid email address.');
      return;
    }
    
    setBulkUsersList(validatedEntries);
    setBulkInProgress(true);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < validatedEntries.length; i++) {
      const entry = validatedEntries[i];
      if (entry.status === 'failed') {
        failCount++;
        continue;
      }
      
      // update state row to provisioning
      setBulkUsersList(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'creating' } : item));
      
      try {
        // Create secondaryAuth user
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, entry.email, entry.password);
        const newUserId = userCredential.user.uid;
        
        // Write Firestore doc
        await setDoc(doc(db, 'users', newUserId), {
          email: entry.email,
          role: bulkRole,
          status: 'approved',
          needsPasswordChange: true,
          createdAt: serverTimestamp()
        });
        
        // Log event
        await logEvent(
          'user_created',
          auth.currentUser?.uid || 'admin',
          auth.currentUser?.email || '',
          `Bulk created team user ${entry.email} (Access Type: ${bulkRole})`
        );
        
        // Sign out of secondary auth just to keep it clean
        await secondaryAuth.signOut();
        
        // update status to success
        setBulkUsersList(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'success' } : item));
        successCount++;
      } catch (err: any) {
        console.error(`Bulk registration fail: ${entry.email}`, err);
        const errMsg = err.message || 'Already registered or incorrect parameters';
        setBulkUsersList(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'failed', error: errMsg } : item));
        failCount++;
      }
      
      // Delay so state is fully synchronized and animated visually
      await new Promise(r => setTimeout(r, 150));
    }
    
    setBulkInProgress(false);
    if (successCount > 0) {
      setSuccess(`Successfully provisioned logins and registered ${successCount} member profiles. Credentials can be distributed from below.`);
    }
    if (failCount > 0) {
      setError(`Failed to create ${failCount} team logins. See specific reasons of failures in rows below.`);
    }
  };

  const handleExportCSV = () => {
    if (bulkUsersList.length === 0) return;
    const csvRows = [
      ["Email", "Password", "Role", "Status"].join(",")
    ];
    for (const u of bulkUsersList) {
      csvRows.push(`"${u.email}","${u.password}","${bulkRole}","${u.status === 'success' ? 'Created Successfully' : 'Failed'}"`);
    }
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sussex_cameras_bulk_operators_${bulkRole}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyAll = () => {
    if (bulkUsersList.length === 0) return;
    const formatStr = bulkUsersList
      .filter(item => item.status === 'success')
      .map(item => `Email: ${item.email} | Temporary Password: ${item.password} | Access Level: ${bulkRole}`)
      .join('\n');
      
    if (!formatStr) {
      alert("No active verified user logins to copy.");
      return;
    }
    
    navigator.clipboard.writeText(formatStr);
    setBulkCopiedAll(true);
    setTimeout(() => setBulkCopiedAll(false), 3000);
  };

  const handleCopyIndividual = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setBulkCopiedIndex(idx);
    setTimeout(() => setBulkCopiedIndex(null), 3000);
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'approved' });
    } catch (err: any) {
      setError(err.message || 'Failed to approve user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this user? They will no longer be able to access the system.')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const handleResetPassword = async (userEmail: string) => {
    if (!window.confirm(`Send password reset email to ${userEmail}?`)) return;
    try {
      await sendPasswordResetEmail(auth, userEmail);
      setSuccess(`Password reset email sent to ${userEmail}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[3000] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="text-blue-600" />
            Admin Panel
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-gray-200 overflow-x-auto flex-nowrap scrollbar-none">
          <button
            className={`px-4 py-3 font-medium text-sm transition-colors flex-shrink-0 text-center whitespace-nowrap border-b-2 ${activeTab === 'users' ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
            onClick={() => setActiveTab('users')}
          >
            Manage Users
          </button>
          <button
            className={`px-4 py-3 font-medium text-sm transition-colors flex-shrink-0 text-center whitespace-nowrap border-b-2 ${activeTab === 'add' ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
            onClick={() => setActiveTab('add')}
          >
            Add User
          </button>
          <button
            className={`px-4 py-3 font-medium text-sm transition-colors flex-shrink-0 text-center whitespace-nowrap border-b-2 ${activeTab === 'bulk_add' ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
            onClick={() => setActiveTab('bulk_add')}
          >
            Bulk Add Teams
          </button>
          <button
            className={`px-4 py-3 font-medium text-sm transition-colors flex-shrink-0 text-center whitespace-nowrap border-b-2 ${activeTab === 'logs' ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
            onClick={() => setActiveTab('logs')}
          >
            Event Logs
          </button>
          <button
            className={`px-4 py-3 font-medium text-sm transition-colors flex-shrink-0 text-center whitespace-nowrap border-b-2 ${activeTab === 'archive' ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
            onClick={() => setActiveTab('archive')}
          >
            Trash & Archives (30d)
          </button>
          <button
            className={`px-4 py-3 font-medium text-sm transition-colors flex-shrink-0 text-center whitespace-nowrap border-b-2 ${activeTab === 'audit' ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
            onClick={() => setActiveTab('audit')}
          >
            Registry Audit & Correction
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded-md mb-4 text-sm border border-green-200">
              {success}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="grid gap-4">
                {users.map((u) => (
                  <div key={u.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {u.email}
                        {u.status === 'pending' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-semibold">Pending</span>
                        )}
                        {u.needsPasswordChange && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-semibold">Needs Password Change</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Joined: {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 p-2"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      
                      {u.status === 'pending' && (
                        <button
                          onClick={() => handleApproveUser(u.id)}
                          className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-2 rounded-md hover:bg-green-200 transition-colors text-sm font-medium"
                        >
                          <CheckCircle size={16} /> Approve
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleResetPassword(u.email)}
                        className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-2 rounded-md hover:bg-blue-200 transition-colors text-sm font-medium"
                        title="Send Password Reset Email"
                      >
                        <Key size={16} /> Reset
                      </button>

                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-2 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No users found.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <form onSubmit={handleCreateUser} className="max-w-md mx-auto space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-200">
              <div className="text-center mb-6">
                <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                  <UserPlus size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Add New User</h3>
                <p className="text-sm text-gray-500">Create an account for a new officer or staff member.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="officer@police.uk"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="user">User (Can add/edit cameras)</option>
                  <option value="admin">Admin (Full access)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-6"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                Create User
              </button>
            </form>
          )}

          {activeTab === 'bulk_add' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                  <Users size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Bulk Add Teams</h3>
                <p className="text-sm text-gray-500">Provide user emails in bulk to instantly create logins with auto-generated passwords.</p>
              </div>

              {/* Step 1: Access Type / Role selection */}
              <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label className="block text-sm font-bold text-blue-900">Step 1: Select Team Role / Access Type</label>
                  <p className="text-xs text-blue-700/80">Every email listed below will be bulk created with this clearance level.</p>
                </div>
                <select
                  disabled={bulkInProgress}
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value as UserRole)}
                  className="bg-white border border-blue-200 text-gray-800 text-sm font-semibold rounded-lg focus:ring-2 focus:ring-blue-500 p-2.5 min-w-[200px]"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="user">User (Add/Edit cameras)</option>
                  <option value="admin">Admin (Full administrative control)</option>
                </select>
              </div>

              {/* Step 2: Enter emails */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">Step 2: Enter Email Addresses</label>
                <textarea
                  rows={5}
                  required
                  disabled={bulkInProgress}
                  value={bulkEmailsText}
                  onChange={(e) => setBulkEmailsText(e.target.value)}
                  className="w-full font-mono text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="cop.one@sussex.police.uk&#10;cop.two@sussex.police.uk, cop.three@sussex.police.uk&#10;cop.four@sussex.police.uk"
                />
                <p className="text-xs text-gray-400">Separators allowed: Newlines, commas, semi-colons, or spaces.</p>
              </div>

              {/* Run provision action */}
              <button
                type="button"
                onClick={handleBulkAddUsers}
                disabled={bulkInProgress || !bulkEmailsText.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {bulkInProgress ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                {bulkInProgress ? 'Provisioning Accounts... (sequential)' : 'Generate Logins & Register Profiles'}
              </button>

              {/* Bulk Output Results */}
              {bulkUsersList.length > 0 && (
                <div className="mt-8 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 rounded-xl border border-gray-200 gap-3">
                    <div>
                      <h4 className="font-bold text-gray-850 text-sm flex items-center gap-1.5">
                        <CheckCircle size={16} className="text-emerald-600" />
                        Credentials Provisioning Log
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">Export or copy down logins. For security, passwords will require change on first login.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleCopyAll}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white hover:bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 shadow-sm transition-colors cursor-pointer"
                        title="Copy successful logins list"
                      >
                        {bulkCopiedAll ? <Check size={14} className="text-emerald-600" /> : <Copy size={13} />}
                        {bulkCopiedAll ? 'All Copied!' : 'Copy All'}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white hover:bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 shadow-sm transition-colors cursor-pointer"
                        title="Download CSV spreadsheet"
                      >
                        <Download size={13} />
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs bg-white divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
                    {bulkUsersList.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 gap-2 hover:bg-gray-50/60 transition-colors">
                        <div className="min-w-0">
                          <span className="font-bold text-gray-900 text-sm break-all">{item.email}</span>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-gray-600 tracking-wide font-mono">
                              Password: <span className="font-bold text-indigo-700">{item.password}</span>
                            </span>
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-extrabold uppercase tracking-wider">
                              {bulkRole}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3.5 self-end sm:self-center">
                          {item.status === 'pending' && (
                            <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                              <Clock size={12} /> Pending
                            </span>
                          )}
                          {item.status === 'creating' && (
                            <span className="text-xs text-blue-600 font-bold flex items-center gap-1.5 animate-pulse">
                              <Loader2 size={12} className="animate-spin" /> Registering...
                            </span>
                          )}
                          {item.status === 'success' && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle size={13} /> Registered
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyIndividual(`Email: ${item.email} | Temporary Password: ${item.password} | Role: ${bulkRole}`, idx)}
                                className="p-1 px-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-[10px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer"
                              >
                                {bulkCopiedIndex === idx ? <Check size={10} className="text-emerald-700" /> : <Copy size={10} />}
                                {bulkCopiedIndex === idx ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          )}
                          {item.status === 'failed' && (
                            <div className="text-right">
                              <span className="text-xs text-red-600 font-bold flex items-center gap-1 justify-end">
                                ⚠️ Failure
                              </span>
                              <p className="text-[10px] text-red-500 mt-0.5 max-w-sm font-medium">{item.error || 'Configuration mismatch'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Activity size={18} className="text-blue-600" />
                Recent System Activity
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {event.timestamp?.toDate ? event.timestamp.toDate().toLocaleString() : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {event.userEmail}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                            {event.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {event.details || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {events.length === 0 && (
                  <div className="p-8 text-center text-gray-500">No recent activity logs found.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'archive' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                  <Trash2 size={18} className="text-red-655 text-red-650" />
                  Deleted Cameras Archive (Held for 30 Days)
                </h3>
                <span className="bg-slate-200 text-slate-800 px-2.5 py-1 rounded-full font-bold text-xs">
                  {archivedCameras.length} Items Total
                </span>
              </div>
              
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Camera Details</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deleted By</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deleted At</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Held Remaining</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-xs">
                    {archivedCameras.map((archived) => {
                      const deletedAtDate = archived.deletedAt?.toDate ? archived.deletedAt.toDate() : new Date();
                      const expiresAtDate = archived.expiresAt?.toDate ? archived.expiresAt.toDate() : new Date();
                      const daysLeft = Math.max(0, Math.ceil((expiresAtDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      
                      return (
                        <tr key={archived.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-800 text-sm">
                              {archived.originalCamera.name || archived.originalCamera.type.replace('_', ' ')}
                            </div>
                            <div className="text-xs text-slate-500 capitalize mt-0.5 font-medium">
                              Type: {archived.originalCamera.type.replace('_', ' ')} | Ref: {archived.originalCamera.policeReferenceNumber || 'N/A'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              COORDS: {archived.originalCamera.latitude.toFixed(5)}, {archived.originalCamera.longitude.toFixed(5)}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-600 font-medium">
                            {archived.deletedByEmail}
                          </td>
                          <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                            {deletedAtDate.toLocaleString()}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full inline-flex items-center gap-1.5 ${
                                daysLeft > 15 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                daysLeft > 5 ? 'bg-amber-50 text-amber-700 border border-amber-100 font-bold' :
                                'bg-red-50 text-red-700 animate-pulse border border-red-100 font-bold'
                            }`}>
                              <Clock size={11} />
                              {daysLeft} days
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleRestoreCamera(archived)}
                                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm hover:shadow"
                                title="Restore to registry"
                              >
                                <RotateCcw size={12} />
                                Restore
                              </button>
                              <button
                                onClick={() => handlePermanentDelete(archived)}
                                className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                title="Purge permanently"
                              >
                                <Trash2 size={12} />
                                Purge
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {archivedCameras.length === 0 && (
                  <div className="p-10 text-center text-gray-500 bg-slate-50/20">
                    <p className="font-semibold text-slate-700 text-sm">Backup Archive is empty.</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">Deleted cameras are safely retained in archive for 30 days before being permanently removed from the system.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Executive Summary Card */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-xl border border-indigo-950 shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Compass className="text-indigo-400" size={20} />
                      Data Alignment & Position Audit
                    </h3>
                    <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
                      Analyze the registry state to identify offshore coordinate displacements and resolve standard uncalibrated apertures (90-degree cones). Keep Sussex surveillance coordinates high-fidelity and aligned to mainland streets.
                    </p>
                  </div>
                  <div className="bg-indigo-950 px-3 py-2 rounded-lg text-center hidden sm:block border border-indigo-800/30">
                    <span className="block text-2xl font-extrabold text-indigo-300">{auditCameras.length}</span>
                    <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold">Total Nodes</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
                  <div className="bg-slate-900/60 p-3.5 rounded-lg border border-indigo-800/40">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Offshore Warnings</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-amber-400 font-mono">
                        {auditCameras.filter(c => c.latitude < 50.8080).length}
                      </span>
                      <span className="text-xs text-slate-300">placed below shoreline</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-lg border border-indigo-800/40">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Uniform Aperture</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-indigo-300 font-mono">
                        {auditCameras.filter(c => c.fieldOfView === 90 || c.fieldOfView === undefined).length}
                      </span>
                      <span className="text-xs text-slate-300">locked to exactly 90° FOV</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-lg border border-indigo-800/40">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider font-semibold">Aperture Calibrated</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                        {auditCameras.filter(c => c.fieldOfView !== undefined && c.fieldOfView !== 90).length}
                      </span>
                      <span className="text-xs text-slate-300">nodes customized</span>
                    </div>
                  </div>
                </div>

                {/* Bulk Fix Quick Actions */}
                <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-4 border-t border-indigo-800/50">
                  <button
                    type="button"
                    disabled={bulkActionLoading || auditCameras.filter(c => c.latitude < 50.8080).length === 0}
                    onClick={handleBulkMoveSeaCameras}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-45 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {bulkActionLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                    Bulk Re-align Offshore Sensors (Shift to Shoreline)
                  </button>

                  <button
                    type="button"
                    disabled={bulkActionLoading || auditCameras.filter(c => c.fieldOfView === 90 || c.fieldOfView === undefined).length === 0}
                    onClick={handleBulkFOVDiverse}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {bulkActionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Batch Optimize Legacy 90° Cones by Lens Type
                  </button>
                </div>
              </div>

              {/* Data Table Analyzer */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    <Sliders size={16} className="text-indigo-600" />
                    Interactive Registry Coordinates & Aperture Grid
                  </h4>
                  <span className="text-xs text-gray-500 italic">Changes persist instantly to live map</span>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                  {auditCameras.map((camera) => {
                    const isOffshore = camera.latitude < 50.8080;
                    const isDefaultFov = camera.fieldOfView === 90 || camera.fieldOfView === undefined;
                    const fields = editingCameraFields[camera.id] || {
                      latitude: camera.latitude.toString(),
                      longitude: camera.longitude.toString(),
                      fieldOfView: (camera.fieldOfView ?? 90).toString(),
                      direction: (camera.direction ?? 0).toString()
                    };

                    return (
                      <div key={camera.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors text-xs">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-950 text-sm truncate max-w-[220px]" title={camera.name}>
                              {camera.name || `${camera.type.replace('_', ' ')} Node`}
                            </span>
                            <span className="text-[9px] font-extrabold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 select-none">
                              {camera.type.replace('_', ' ')}
                            </span>
                            {isOffshore && (
                              <span className="text-[9px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse select-none">
                                <AlertTriangle size={10} /> Offshore
                              </span>
                            )}
                            {isDefaultFov && (
                              <span className="text-[9px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded select-none">
                                Default 90° FOV
                              </span>
                            )}
                          </div>
                          
                          <p className="text-[10px] text-gray-400 truncate max-w-[300px]" title={camera.address}>
                            {camera.address || 'Address not listed'}
                          </p>
                          <p className="text-[9px] font-mono text-gray-400">
                            ID: {camera.id.slice(0, 8)}... | {camera.creatorEmail || 'system_seeder'}
                          </p>
                        </div>

                        {/* Direct Editable Parameters */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Latitude Input */}
                          <div className="space-y-0.5">
                            <span className="block text-[8px] font-bold text-gray-450 uppercase tracking-wider">Latitude</span>
                            <input
                              type="text"
                              value={fields.latitude}
                              onChange={(e) => setEditingCameraFields(prev => ({
                                ...prev,
                                [camera.id]: { ...prev[camera.id], latitude: e.target.value }
                              }))}
                              className={`w-20 font-mono text-xs font-bold border rounded p-1.5 ${isOffshore ? 'border-amber-400 bg-amber-50/30 text-amber-900' : 'border-gray-200 text-gray-900 bg-white'}`}
                              placeholder="50.8123"
                            />
                          </div>

                          {/* Longitude Input */}
                          <div className="space-y-0.5">
                            <span className="block text-[8px] font-bold text-gray-450 uppercase tracking-wider">Longitude</span>
                            <input
                              type="text"
                              value={fields.longitude}
                              onChange={(e) => setEditingCameraFields(prev => ({
                                ...prev,
                                [camera.id]: { ...prev[camera.id], longitude: e.target.value }
                              }))}
                              className="w-20 font-mono text-xs border border-gray-200 text-gray-900 bg-white rounded p-1.5"
                              placeholder="-0.3712"
                            />
                          </div>

                          {/* Direction Angle Input */}
                          <div className="space-y-0.5">
                            <span className="block text-[8px] font-bold text-gray-450 uppercase tracking-wider">Direction°</span>
                            <input
                              type="number"
                              min="0"
                              max="359"
                              value={fields.direction}
                              onChange={(e) => setEditingCameraFields(prev => ({
                                ...prev,
                                [camera.id]: { ...prev[camera.id], direction: e.target.value }
                              }))}
                              className="w-16 font-mono text-xs border border-gray-200 text-gray-900 bg-white rounded p-1.5"
                              placeholder="180"
                            />
                          </div>

                          {/* FOV Conic Input */}
                          <div className="space-y-0.5">
                            <span className="block text-[8px] font-bold text-gray-450 uppercase tracking-wider">FOV Cone°</span>
                            <input
                              type="number"
                              min="10"
                              max="360"
                              value={fields.fieldOfView}
                              onChange={(e) => setEditingCameraFields(prev => ({
                                ...prev,
                                [camera.id]: { ...prev[camera.id], fieldOfView: e.target.value }
                              }))}
                              className={`w-16 font-mono text-xs font-bold border rounded p-1.5 ${isDefaultFov ? 'border-indigo-200 bg-indigo-50/30 text-indigo-900' : 'border-gray-200 text-gray-900 bg-white'}`}
                              placeholder="90"
                            />
                          </div>

                          {/* Save/Commit changes button */}
                          <div className="pt-3.5 lg:pt-0">
                            <button
                              type="button"
                              onClick={() => handleSaveAuditCamera(camera.id)}
                              disabled={savingCameraId === camera.id}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold p-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center border-none"
                              title="Commit edits for this sensor"
                            >
                              {savingCameraId === camera.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {auditCameras.length === 0 && (
                    <div className="p-10 text-center text-gray-400">Loading audit cameras...</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
