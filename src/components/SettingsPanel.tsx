import { useEffect, useState } from 'react';
import { Camera as CameraIcon, Download, KeyRound, X, Folder, ShieldAlert } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { changePassword, forgetFolder, loadStoredFolder } from '../services/storage';
import { listCameras } from '../services/localApi';
import { exportToCSV } from '../utils/storage';
import { CREATOR_CREDIT } from '../copy';

interface SettingsPanelProps {
  initials: string;
  onChangeInitials: (next: string) => void;
  onClose: () => void;
  onLock: () => void;
}

export default function SettingsPanel({
  initials,
  onChangeInitials,
  onClose,
  onLock,
}: SettingsPanelProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [initialsLocal, setInitialsLocal] = useState(initials);

  useEffect(() => {
    loadStoredFolder().then((f) => setFolderName(f?.name ?? null));
  }, []);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
    if (newPw.length < 10) {
      setPwError('New password must be at least 10 characters.');
      return;
    }
    if (newPw !== newPw2) {
      setPwError('The two new passwords don\'t match.');
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(oldPw, newPw);
      setOldPw('');
      setNewPw('');
      setNewPw2('');
      setPwOk(true);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Could not change the password.');
    } finally {
      setPwBusy(false);
    }
  };

  const handleSaveInitials = () => {
    onChangeInitials(initialsLocal.trim().toUpperCase());
  };

  const handleSwitchFolder = async () => {
    await forgetFolder();
    onLock();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2500] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        ref={containerRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <header className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <h2 id="settings-title" className="text-lg font-bold text-slate-900">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </header>

        <div className="overflow-y-auto p-6 space-y-8">
          <section>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Folder size={18} className="text-blue-700" aria-hidden="true" /> Connected folder
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              The registry's data file lives in this OneDrive / SharePoint folder. Anyone
              with this folder and the password can read the data.
            </p>
            <p className="mt-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono break-all">
              {folderName ?? '—'}
            </p>
            <button
              type="button"
              onClick={handleSwitchFolder}
              className="mt-3 text-sm text-blue-700 hover:underline"
            >
              Switch to a different folder
            </button>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <CameraIcon size={18} className="text-blue-700" aria-hidden="true" /> Your initials
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Shown on cameras you add or edit. Not a real sign-in.
            </p>
            <div className="mt-3 flex gap-2">
              <label htmlFor="settings-initials" className="sr-only">
                Initials
              </label>
              <input
                id="settings-initials"
                type="text"
                value={initialsLocal}
                onChange={(e) => setInitialsLocal(e.target.value.slice(0, 6).toUpperCase())}
                className="flex-1 border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
                maxLength={6}
              />
              <button
                type="button"
                onClick={handleSaveInitials}
                className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-4 rounded-lg"
              >
                Save
              </button>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound size={18} className="text-blue-700" aria-hidden="true" /> Change the
              shared password
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Re-encrypts the data file with a new password. Tell your team the new one
              afterwards — there's no recovery.
            </p>
            <form onSubmit={handleSavePassword} className="mt-3 space-y-3">
              <div>
                <label htmlFor="set-old-pw" className="block text-sm font-medium">
                  Current password
                </label>
                <input
                  id="set-old-pw"
                  type="password"
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                  className="mt-1 w-full border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="set-new-pw" className="block text-sm font-medium">
                  New password
                </label>
                <input
                  id="set-new-pw"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="mt-1 w-full border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="set-new-pw-2" className="block text-sm font-medium">
                  Type the new password again
                </label>
                <input
                  id="set-new-pw-2"
                  type="password"
                  value={newPw2}
                  onChange={(e) => setNewPw2(e.target.value)}
                  className="mt-1 w-full border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {pwError && (
                <p role="alert" className="text-sm text-red-700 flex items-center gap-1">
                  <ShieldAlert size={16} aria-hidden="true" /> {pwError}
                </p>
              )}
              {pwOk && <p className="text-sm text-green-700">Password updated.</p>}
              <button
                type="submit"
                disabled={pwBusy}
                className="bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 px-4 rounded-lg disabled:opacity-50"
              >
                Update password
              </button>
            </form>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Download size={18} className="text-blue-700" aria-hidden="true" /> Backup
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Download a CSV copy of every camera. Keep it somewhere safe in case the
              data file is lost or the password is forgotten.
            </p>
            <button
              type="button"
              onClick={() => exportToCSV(listCameras())}
              className="mt-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-medium py-2 px-4 rounded-lg"
            >
              Download CSV backup
            </button>
          </section>
        </div>

        <footer className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
          {CREATOR_CREDIT}
        </footer>
      </div>
    </div>
  );
}
