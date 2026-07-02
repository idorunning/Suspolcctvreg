import { useEffect, useState } from 'react';
import { Camera, CameraType } from '../types';
import { X, Save, Crosshair, Camera as CameraIcon, Trash2, CheckCircle, ShieldAlert, EyeOff } from 'lucide-react';
import { scanForPII } from '../utils/privacy';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { getStoredInitials, normalizeInitials, storeInitials } from '../utils/initials';

interface AddCameraModalProps {
  lat: number;
  lng: number;
  onClose: () => void;
  onSave: (camera: Partial<Camera>, initials: string) => Promise<void>;
  initialData?: Camera | null;
  draftDirection?: number;
  draftDistance?: number;
  onSetPosition?: (currentData: Partial<Camera>) => void;
  onDelete?: () => void;
  onVerify?: () => void;
}

const CAMERA_TYPES: { id: CameraType; label: string }[] = [
  { id: 'cctv', label: 'Retail / shop CCTV' },
  { id: 'police_council', label: 'Police or council camera' },
  { id: 'pfs', label: 'Petrol station (PFS)' },
  { id: 'other', label: 'Other public camera' },
];

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function AddCameraModal({
  lat,
  lng,
  onClose,
  onSave,
  initialData,
  draftDirection,
  draftDistance,
  onSetPosition,
  onDelete,
  onVerify,
}: AddCameraModalProps) {
  const [type, setType] = useState<CameraType>(initialData?.type || 'cctv');
  const [name, setName] = useState(initialData?.name || '');
  const [policeReferenceNumber, setPoliceReferenceNumber] = useState(
    initialData?.policeReferenceNumber || '',
  );
  const [address, setAddress] = useState(initialData?.address || '');
  const [publicOutputUrl, setPublicOutputUrl] = useState(initialData?.publicOutputUrl || '');
  const [direction, setDirection] = useState<number | ''>(
    initialData?.direction ?? (draftDirection ?? ''),
  );
  const [fieldOfView, setFieldOfView] = useState<number | ''>(initialData?.fieldOfView ?? 90);
  const [viewDistance, setViewDistance] = useState<number | ''>(
    initialData?.viewDistance ?? (draftDistance ?? 30),
  );
  const [initials, setInitials] = useState(() => getStoredInitials());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);

  useEffect(() => {
    if (draftDirection !== undefined) setDirection(draftDirection);
  }, [draftDirection]);

  useEffect(() => {
    if (draftDistance !== undefined) setViewDistance(draftDistance);
  }, [draftDistance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    for (const [label, value] of [
      ['Camera name', name],
      ['Police reference', policeReferenceNumber],
      ['Address', address],
    ] as const) {
      const violation = scanForPII(value);
      if (violation) {
        setError(`${label}: ${violation}`);
        setIsSaving(false);
        return;
      }
    }

    const trimmedUrl = publicOutputUrl.trim();
    if (trimmedUrl !== '' && !/^https?:\/\//i.test(trimmedUrl)) {
      setError('Feed link must start with http:// or https://');
      setIsSaving(false);
      return;
    }

    if (initials.trim() === '') {
      setError('Your initials are required.');
      setIsSaving(false);
      return;
    }

    try {
      storeInitials(initials);
      await onSave(
        {
          type,
          name: name.trim() === '' ? null : name.trim(),
          policeReferenceNumber:
            policeReferenceNumber.trim() === '' ? null : policeReferenceNumber.trim(),
          address: address.trim() === '' ? null : address.trim(),
          publicOutputUrl: trimmedUrl === '' ? null : trimmedUrl,
          latitude: lat,
          longitude: lng,
          direction: direction === '' ? null : Number(direction),
          fieldOfView: fieldOfView === '' ? null : Number(fieldOfView),
          viewDistance: viewDistance === '' ? null : Number(viewDistance),
        },
        initials,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the camera.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[2000] p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div
        ref={containerRef}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] pointer-events-auto"
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            {initialData ? (
              <CameraIcon className="text-blue-700" size={18} aria-hidden="true" />
            ) : (
              <Crosshair className="text-blue-700" size={18} aria-hidden="true" />
            )}
            <h2 id="camera-modal-title" className="text-base font-bold text-slate-900">
              {initialData ? 'Edit camera' : 'Add a camera'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex gap-2 items-start">
            <EyeOff size={16} className="text-blue-700 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-blue-900 leading-relaxed">
              <strong>No personal data.</strong> No names, phone numbers, emails, or exact
              house numbers. Public-facing cameras only — never covert, sensitive, or
              personally owned cameras like Ring doorbells.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="bg-red-50 border border-red-200 p-3 rounded-xl flex gap-2 text-sm text-red-800"
            >
              <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              {error}
            </p>
          )}

          <form id="camera-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="cam-type" className="block text-sm font-medium text-slate-700 mb-1">
                Camera type
              </label>
              <select
                id="cam-type"
                value={type}
                onChange={(e) => setType(e.target.value as CameraType)}
                className="w-full border border-slate-300 rounded-lg py-2.5 px-3 bg-white focus:ring-2 focus:ring-blue-500"
              >
                {CAMERA_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cam-name" className="block text-sm font-medium text-slate-700 mb-1">
                Short label (optional)
              </label>
              <input
                id="cam-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bus station ticket hall"
                className="w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="cam-ref" className="block text-sm font-medium text-slate-700 mb-1">
                Police reference (optional)
              </label>
              <input
                id="cam-ref"
                type="text"
                value={policeReferenceNumber}
                onChange={(e) => setPoliceReferenceNumber(e.target.value)}
                placeholder="e.g. CAD 1234"
                className="w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="cam-address" className="block text-sm font-medium text-slate-700 mb-1">
                Where it is (optional)
              </label>
              <input
                id="cam-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. London Road, near the junction"
                className="w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="cam-url"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Public feed link (optional)
              </label>
              <input
                id="cam-url"
                type="url"
                inputMode="url"
                value={publicOutputUrl}
                onChange={(e) => setPublicOutputUrl(e.target.value)}
                placeholder="https://… public feed only"
                className="w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="cam-initials" className="block text-sm font-medium text-slate-700 mb-1">
                Your initials
              </label>
              <input
                id="cam-initials"
                type="text"
                value={initials}
                onChange={(e) => setInitials(normalizeInitials(e.target.value))}
                placeholder="e.g. NT"
                maxLength={6}
                className="w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Shown against this camera. Not a real sign-in.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-sm font-medium text-slate-700 mb-1">Position</p>
              <p className="font-mono text-xs text-slate-600">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
              {onSetPosition && (
                <button
                  type="button"
                  onClick={() =>
                    onSetPosition({
                      type,
                      name,
                      policeReferenceNumber,
                      address,
                      publicOutputUrl,
                      direction: direction === '' ? null : Number(direction),
                      fieldOfView: fieldOfView === '' ? null : Number(fieldOfView),
                      viewDistance: viewDistance === '' ? null : Number(viewDistance),
                    })
                  }
                  className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
                >
                  <Crosshair size={14} aria-hidden="true" />
                  Move pin on the map
                </button>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Drag the red arrow on the map to point the camera. Drag the blue handles to
                widen or narrow what it sees.
              </p>
            </div>

            {initialData && (
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                <span>Created: {formatDate(initialData.createdAt)}</span>
                <span>Last checked: {formatDate(initialData.lastVerifiedAt)}</span>
                <span>Added by: {initialData.addedBy || '—'}</span>
                <span>Last edited by: {initialData.lastEditedBy || '—'}</span>
              </div>
            )}
          </form>
        </div>

        <footer className="flex justify-between gap-2 p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex gap-2">
            {initialData && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                title="Delete this camera"
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            )}
            {initialData && onVerify && (
              <button
                type="button"
                onClick={onVerify}
                className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                title="Mark as still in place"
              >
                <CheckCircle size={16} aria-hidden="true" />
                Still there
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="camera-form"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg flex items-center gap-2 font-medium disabled:opacity-60 transition-colors"
            >
              {isSaving ? (
                <span
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Save size={16} aria-hidden="true" />
              )}
              {initialData ? 'Save changes' : 'Add camera'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
