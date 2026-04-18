import React, { useState, useEffect } from 'react';
import { secondaryAuth, createUserWithEmailAndPassword, db, auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { User, UserRole, UserStatus, EventLog } from '../types';
import { X, UserPlus, Loader2, CheckCircle, Trash2, ShieldAlert, Activity, Key } from 'lucide-react';

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'add' | 'logs'>('users');

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

        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-3 font-medium text-sm transition-colors ${activeTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('users')}
          >
            Manage Users
          </button>
          <button
            className={`flex-1 py-3 font-medium text-sm transition-colors ${activeTab === 'add' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('add')}
          >
            Add User
          </button>
          <button
            className={`flex-1 py-3 font-medium text-sm transition-colors ${activeTab === 'logs' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('logs')}
          >
            Event Logs
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
        </div>
      </div>
    </div>
  );
}
