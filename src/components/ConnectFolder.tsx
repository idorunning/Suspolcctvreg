import { useEffect, useMemo, useState } from 'react';
import { Folder, Info, Loader2 } from 'lucide-react';
import {
  hasExistingData,
  initRegistry,
  isFsaSupported,
  loadRegistry,
  loadStoredFolder,
  pickFolder,
} from '../services/storage';
import { bootFromState } from '../services/localApi';
import {
  APP_TITLE,
  CREATOR_CREDIT,
  DISCLAIMER_POINTS,
  DISCLAIMER_TITLE,
  CONNECT,
} from '../copy';

type Step = 'loading' | 'pick';

interface ConnectFolderProps {
  onConnected: () => void;
}

export default function ConnectFolder({ onConnected }: ConnectFolderProps) {
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [folderLabel, setFolderLabel] = useState<string | null>(null);

  const fsaOk = useMemo(() => isFsaSupported(), []);

  const connectAndEnter = async () => {
    setError(null);
    setBusy(true);
    try {
      const state = (await hasExistingData()) ? await loadRegistry() : await initRegistry();
      bootFromState(state);
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the registry.');
      setStep('pick');
    } finally {
      setBusy(false);
    }
  };

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
        await connectAndEnter();
      } catch {
        if (!cancelled) setStep('pick');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = async () => {
    setError(null);
    setBusy(true);
    try {
      const folder = await pickFolder();
      setFolderLabel(folder.name);
      await connectAndEnter();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to the folder.');
    } finally {
      setBusy(false);
    }
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
            {step === 'loading' && (
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                <p>{folderLabel ? `Connecting to ${folderLabel}…` : 'Loading…'}</p>
              </div>
            )}

            {step === 'pick' && (
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Folder size={20} className="text-blue-700" aria-hidden="true" />
                  {CONNECT.pickFolderTitle}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{CONNECT.pickFolderBody}</p>
                {!fsaOk && (
                  <p
                    role="alert"
                    className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3"
                  >
                    {CONNECT.fsaNotSupported}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handlePick}
                  disabled={!fsaOk || busy}
                  className="mt-5 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {CONNECT.pickFolderBtn}
                </button>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-slate-500">{CREATOR_CREDIT}</footer>
    </div>
  );
}
