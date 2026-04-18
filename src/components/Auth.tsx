import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Shield, Loader2 } from 'lucide-react';
import { logEvent } from '../utils/eventLogger';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (isReset) {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Password reset email sent. Please check your inbox.');
        setIsReset(false);
      } else if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await logEvent('login', cred.user.uid, cred.user.email || '', 'User logged in');
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await logEvent('login', cred.user.uid, cred.user.email || '', 'User registered and logged in');
      }
    } catch (err: any) {
      setError(err.message || `Failed to ${isReset ? 'reset password' : isLogin ? 'sign in' : 'sign up'}`);
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
          Secure police reference tool for logging and locating accessible CCTV and doorbell cameras.
        </p>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm text-left border border-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-md mb-4 text-sm text-left border border-green-200">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="officer@police.uk"
            />
          </div>
          {!isReset && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-4"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : (isReset ? 'Reset Password' : isLogin ? 'Sign In' : 'Request Access')}
          </button>
        </form>
        
        <div className="mt-4 flex flex-col gap-2 text-sm">
          {!isReset && (
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }} 
              className="text-blue-600 hover:underline"
            >
              {isLogin ? "Don't have an account? Request Access" : "Already have an account? Sign In"}
            </button>
          )}
          
          {isLogin && !isReset && (
            <button 
              onClick={() => {
                setIsReset(true);
                setError('');
                setSuccess('');
              }} 
              className="text-gray-500 hover:underline"
            >
              Forgot Password?
            </button>
          )}

          {isReset && (
            <button 
              onClick={() => {
                setIsReset(false);
                setError('');
                setSuccess('');
              }} 
              className="text-blue-600 hover:underline"
            >
              Back to Sign In
            </button>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Authorized personnel only. All access is logged and monitored. New accounts require administrator approval.{' '}
          <a href="mailto:nathan.tracey@sussex.police.uk" className="text-blue-600 hover:underline">Contact Administrator</a>
        </p>
      </div>
    </div>
  );
}
