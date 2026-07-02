import { useEffect, useState } from 'react';
import { Download, X, Folder } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { forgetFolder, loadStoredFolder } from '../services/storage';
import { listCameras } from '../services/localApi';
import { exportToCSV } from '../utils/storage';
import { CREATOR_CREDIT } from '../copy';

interface SettingsPanelProps {
  onClose: () => void;
  onDisconnect: () => void;
}

export default function SettingsPanel({ onClose, onDisconnect }: SettingsPanelProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [folderName, setFolderName] = useState<string | null>(null);

  useEffect(() => {
    loadStoredFolder().then((f) => setFolderName(f?.name ?? null));
  }, []);

  const handleSwitchFolder = async () => {
    await forgetFolder();
    onDisconnect();
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
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
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
              with access to this folder can read and edit the data.
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
              <Download size={18} className="text-blue-700" aria-hidden="true" /> Backup
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Download a CSV copy of every camera. Keep it somewhere safe in case the
              data file is lost.
            </p>
            <button
              type="button"
              onClick={() => exportToCSV(listCameras())}
              className="mt-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-medium py-2 px-4 rounded-lg transition-colors"
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
