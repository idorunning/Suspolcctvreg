import React, { useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { api, setSession, type CurrentUser } from '../services/api';
import { config } from '../config';

interface AuthProps {
  onSuccess: (user: CurrentUser) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.login(email, password);
      setSession(token, user);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center border-t-4 border-blue-600">
        <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6">
          <Shield size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sussex Camera Registry</h1>
        <p className="text-gray-600 mb-8">
          Secure police reference tool for logging and locating accessible CCTV and
          doorbell cameras. Sign in with your Police network credentials.
        </p>

        {error && (
          <div
            role="alert"
            className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm text-left border border-red-200"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label
              htmlFor="auth-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Work Email or Username
            </label>
            <input
              id="auth-email"
              type="text"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="officer@sussex.police.uk"
            />
          </div>
          <div>
            <label
              htmlFor="auth-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-4"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-500">
          Authorised personnel only. All access is logged and monitored. Passwords
          are managed by your Police network account — use your standard
          self-service portal to reset.
          {config.adminContactEmail && (
            <>
              {' '}Need help?{' '}
              <a
                href={`mailto:${config.adminContactEmail}`}
                className="text-blue-600 hover:underline"
              >
                Contact Administrator
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
