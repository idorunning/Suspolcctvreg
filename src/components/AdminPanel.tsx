import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { X, Loader2, CheckCircle, Trash2, ShieldAlert, Activity } from 'lucide-react';
import type { EventLog, User, UserRole } from '../types';
import { api } from '../services/api';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { formatDate, formatDateTime } from '../utils/datetime';

type Tab = 'users' | 'logs';

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    users: null,
    logs: null,
  });

  const refreshUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const refreshEvents = async () => {
    setLoadingEvents(true);
    try {
      const data = await api.listEvents();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') refreshEvents();
  }, [activeTab]);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      const updated = await api.updateUser(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const updated = await api.updateUser(userId, { status: 'approved' });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to remove this user? They will no longer be able to access the system.',
      )
    )
      return;
    try {
      await api.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccess('User removed.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleTabKey = (e: KeyboardEvent<HTMLButtonElement>, current: Tab) => {
    const tabs: Tab[] = ['users', 'logs'];
    const idx = tabs.indexOf(current);
    if (e.key === 'ArrowRight') {
      const next = tabs[(idx + 1) % tabs.length];
      setActiveTab(next);
      tabRefs.current[next]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      const next = tabs[(idx - 1 + tabs.length) % tabs.length];
      setActiveTab(next);
      tabRefs.current[next]?.focus();
      e.preventDefault();
    }
  };

  const tabClass = (tab: Tab) =>
    `flex-1 py-3 font-medium text-sm transition-colors ${
      activeTab === tab
        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
        : 'text-gray-600 hover:bg-gray-50'
    }`;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[3000] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-panel-title"
    >
      <div
        ref={containerRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h2
            id="admin-panel-title"
            className="text-xl font-bold text-gray-800 flex items-center gap-2"
          >
            <ShieldAlert className="text-blue-600" aria-hidden="true" />
            Admin Panel
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close admin panel"
          >
            <X size={24} />
          </button>
        </div>

        <div role="tablist" aria-label="Admin sections" className="flex border-b border-gray-200">
          <button
            ref={(el) => {
              tabRefs.current.users = el;
            }}
            role="tab"
            id="admin-tab-users"
            aria-selected={activeTab === 'users'}
            aria-controls="admin-tabpanel-users"
            tabIndex={activeTab === 'users' ? 0 : -1}
            onKeyDown={(e) => handleTabKey(e, 'users')}
            className={tabClass('users')}
            onClick={() => setActiveTab('users')}
          >
            Manage Users
          </button>
          <button
            ref={(el) => {
              tabRefs.current.logs = el;
            }}
            role="tab"
            id="admin-tab-logs"
            aria-selected={activeTab === 'logs'}
            aria-controls="admin-tabpanel-logs"
            tabIndex={activeTab === 'logs' ? 0 : -1}
            onKeyDown={(e) => handleTabKey(e, 'logs')}
            className={tabClass('logs')}
            onClick={() => setActiveTab('logs')}
          >
            Event Logs
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div
              role="alert"
              className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm border border-red-200"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="bg-green-50 text-green-600 p-3 rounded-md mb-4 text-sm border border-green-200"
            >
              {success}
            </div>
          )}

          {activeTab === 'users' && (
            <div
              role="tabpanel"
              id="admin-tabpanel-users"
              aria-labelledby="admin-tab-users"
              className="space-y-4"
            >
              <p className="text-sm text-gray-600">
                New sign-ins from the Police network appear here as pending until you
                approve them. Passwords are managed by Active Directory.
              </p>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={16} className="animate-spin" /> Loading users…
                </div>
              ) : users.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No users found.</p>
              ) : (
                <div className="grid gap-4">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {u.email}
                          {u.status === 'pending' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-semibold">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Joined: {formatDate(u.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          className="sr-only"
                          htmlFor={`role-${u.id}`}
                        >
                          Role for {u.email}
                        </label>
                        <select
                          id={`role-${u.id}`}
                          value={u.role}
                          onChange={(e) =>
                            handleUpdateRole(u.id, e.target.value as UserRole)
                          }
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
                          onClick={() => handleDeleteUser(u.id)}
                          className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-2 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
                        >
                          <Trash2 size={16} /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div
              role="tabpanel"
              id="admin-tabpanel-logs"
              aria-labelledby="admin-tab-logs"
              className="space-y-4"
            >
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Activity size={18} className="text-blue-600" aria-hidden="true" />
                Recent System Activity
              </h3>
              {loadingEvents ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={16} className="animate-spin" /> Loading events…
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Time
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          User
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Action
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {events.map((event) => (
                        <tr key={event.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(event.timestamp)}
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
                    <div className="p-8 text-center text-gray-500">
                      No recent activity logs found.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
