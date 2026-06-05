import { useEffect, useMemo, useState } from 'react';
import { Folder, Lock, ShieldAlert, KeyRound, Info } from 'lucide-react';
import {
  forgetFolder,
  hasExistingData,
  isFsaSupported,
  loadStoredFolder,
  pickFolder,
  setupPassword,
  unlock,
  WrongPasswordError,
} from '../services/storage';
import { bootFromState } from '../services/localApi';
import {
  APP_TITLE,
  CREATOR_CREDIT,
  DISCLAIMER_POINTS,
  DISCLAIMER_TITLE,
  UNLOCK,
} from '../copy';

type Step = 'loading' | 'pick' | 'setup' | 'unlock' | 'initials';

interface UnlockProps {
  onUnlocked: (initials: string) => void;
}

const INITIALS_STORAGE_KEY = 'sussex_cctv_initials';

export default function Unlock({ onUnlocked }: UnlockProps) {
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [folderLabel, setFolderLabel] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>(
    () => localStorage.getItem(INITIALS_STORAGE_KEY) || '',
  );

  const fsaOk = useMemo(() => isFsaSupported(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const folder = await loadStoredFolder();
        if (cancelled) return;
        if (!folder) {
          setStep('pick');
          return;
        }
        setFolderLabel(folder.name);
        const exists = await hasExistingData();
        if (cancelled) return;
        setStep(exists ? 'unlock' : 'setup');
      } catch {
        if (!cancelled) setStep('pick');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePick = async () => {
    setError(null);
    setBusy(true);
    try {
      const folder = await pickFolder();
      setFolderLabel(folder.name);
      const exists = await hasExistingData();
      setStep(exists ? 'unlock' : 'setup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to the folder.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError(UNLOCK.passwordTooShort);
      return;
    }
    if (password !== passwordConfirm) {
      setError(UNLOCK.passwordsDontMatch);
      return;
    }
    setBusy(true);
    try {
      const state = await setupPassword(password);
      bootFromState(state);
      setStep('initials');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set up the registry.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const state = await unlock(password);
      bootFromState(state);
      setStep('initials');
    } catch (e) {
      if (e instanceof WrongPasswordError) setError(UNLOCK.wrongPassword);
      else setError(e instanceof Error ? e.message : 'Could not unlock the registry.');
    } finally {
      setBusy(false);
    }
  };

  const handleInitials = (e: React.FormEvent) => {
    e.preventDefault();
    const v = initials.trim();
    if (v) localStorage.setItem(INITIALS_STORAGE_KEY, v);
    onUnlocked(v);
  };

  const handleSwitchFolder = async () => {
    await forgetFolder();
    setStep('pick');
    setFolderLabel(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <header className="bg-blue-700 text-white py-4 px-6 shadow">
        <h1 className="text-xl font-bold">{APP_TITLE}</h1>
        <p className="text-xs text-blue-100 mt-0.5">A private, shared register for a small team.</p>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <section className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <Info size={18} className="text-blue-700" aria-hidden="true" />
              {DISCLAIMER_TITLE}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {DISCLAIMER_POINTS.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="text-blue-700" aria-hidden="true">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="p-6 sm:p-8">
            {step === 'loading' && <p className="text-slate-500">Loading…</p>}

            {step === 'pick' && (
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Folder size={20} className="text-blue-700" aria-hidden="true" />
                  {UNLOCK.pickFolderTitle}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{UNLOCK.pickFolderBody}</p>
                {!fsaOk && (
                  <p
                    role="alert"
                    className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3"
                  >
                    {UNLOCK.fsaNotSupported}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handlePick}
                  disabled={!fsaOk || busy}
                  className="mt-5 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
                >
                  {UNLOCK.pickFolderBtn}
                </button>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
            )}

            {step === 'setup' && (
              <form onSubmit={handleSetup}>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <KeyRound size={20} className="text-blue-700" aria-hidden="true" />
                  {UNLOCK.setupTitle}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{UNLOCK.setupBody}</p>
                {folderLabel && (
                  <p className="mt-3 text-xs text-slate-500">
                    Folder: <span className="font-mono">{folderLabel}</span>{' '}
                    <button
                      type="button"
                      onClick={handleSwitchFolder}
                      className="underline text-blue-700"
                    >
                      change
                    </button>
                  </p>
                )}
                <label htmlFor="setup-password" className="block mt-5 text-sm font-medium">
                  Shared password
                </label>
                <input
                  id="setup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={UNLOCK.passwordPlaceholder}
                  className="mt-1 w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  required
                />
                <label htmlFor="setup-password-2" className="block mt-4 text-sm font-medium">
                  Type it again
                </label>
                <input
                  id="setup-password-2"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder={UNLOCK.passwordConfirmPlaceholder}
                  className="mt-1 w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
                  required
                />
                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-700 flex gap-1">
                    <ShieldAlert size={16} aria-hidden="true" />
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-5 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
                >
                  {UNLOCK.setupBtn}
                </button>
              </form>
            )}

            {step === 'unlock' && (
              <form onSubmit={handleUnlock}>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Lock size={20} className="text-blue-700" aria-hidden="true" />
                  {UNLOCK.unlockTitle}
                </h3>
                {folderLabel && (
                  <p className="mt-2 text-xs text-slate-500">
                    Folder: <span className="font-mono">{folderLabel}</span>{' '}
                    <button
                      type="button"
                      onClick={handleSwitchFolder}
                      className="underline text-blue-700"
                    >
                      change
                    </button>
                  </p>
                )}
                <label htmlFor="unlock-password" className="block mt-5 text-sm font-medium">
                  Shared password
                </label>
                <input
                  id="unlock-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={UNLOCK.passwordPlaceholder}
                  className="mt-1 w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  required
                />
                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-700 flex gap-1">
                    <ShieldAlert size={16} aria-hidden="true" />
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-5 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
                >
                  {UNLOCK.unlockBtn}
                </button>
              </form>
            )}

            {step === 'initials' && (
              <form onSubmit={handleInitials}>
                <h3 className="font-bold text-lg text-slate-900">{UNLOCK.initialsTitle}</h3>
                <p className="mt-2 text-sm text-slate-600">{UNLOCK.initialsBody}</p>
                <label htmlFor="initials" className="block mt-5 text-sm font-medium">
                  Your initials
                </label>
                <input
                  id="initials"
                  type="text"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder={UNLOCK.initialsPlaceholder}
                  className="mt-1 w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  maxLength={6}
                />
                <button
                  type="submit"
                  className="mt-5 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl"
                >
                  {UNLOCK.initialsBtn}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-slate-500">{CREATOR_CREDIT}</footer>
    </div>
  );
}
