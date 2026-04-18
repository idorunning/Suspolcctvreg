import React, { useEffect, useState } from 'react';
import { Camera, CameraType } from '../types';
import {
  X,
  Save,
  Crosshair,
  Edit2,
  Camera as CameraIcon,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { formatDateTime } from '../utils/datetime';

interface AddCameraModalProps {
  lat: number;
  lng: number;
  onClose: () => void;
  onSave: (camera: Partial<Camera>) => Promise<void>;
  initialData?: Camera | null;
  draftDirection?: number;
  draftDistance?: number;
  onDirectionChange?: (direction: number) => void;
  onSetPosition?: (currentData: Partial<Camera>) => void;
  onDelete?: () => void;
  onVerify?: () => void;
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [ownerName, setOwnerName] = useState(initialData?.ownerName || '');
  const [policeReferenceNumber, setPoliceReferenceNumber] = useState(
    initialData?.policeReferenceNumber || '',
  );
  const [address, setAddress] = useState(initialData?.address || '');
  const [direction, setDirection] = useState<number | ''>(
    initialData?.direction ?? (draftDirection ?? ''),
  );
  const [fieldOfView, setFieldOfView] = useState<number | ''>(
    initialData?.fieldOfView ?? 90,
  );
  const [viewDistance, setViewDistance] = useState<number | ''>(
    initialData?.viewDistance ?? (draftDistance ?? 30),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);

  // Sync direction state if it changes from outside (e.g., dragging the handle)
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

    try {
      await onSave({
        type,
        name: name.trim() === '' ? undefined : name,
        ownerName: ownerName.trim() === '' ? undefined : ownerName,
        policeReferenceNumber:
          policeReferenceNumber.trim() === '' ? undefined : policeReferenceNumber,
        address: address.trim() === '' ? undefined : address,
        latitude: lat,
        longitude: lng,
        direction: direction === '' ? undefined : Number(direction),
        fieldOfView: fieldOfView === '' ? undefined : Number(fieldOfView),
        viewDistance: viewDistance === '' ? undefined : Number(viewDistance),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save camera');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-transparent flex items-center justify-center z-[2000] p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div
        ref={containerRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto mt-auto mb-4 sm:my-auto border border-gray-200"
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 flex-1">
            {initialData ? (
              <CameraIcon className="text-blue-600" aria-hidden="true" />
            ) : (
              <Crosshair className="text-blue-600" aria-hidden="true" />
            )}
            {isEditingName ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                className="text-xl font-bold text-gray-800 bg-white border border-blue-300 rounded px-2 py-1 w-full max-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Camera name"
                aria-label="Camera name"
              />
            ) : (
              <button
                type="button"
                id="camera-modal-title"
                onClick={() => setIsEditingName(true)}
                className="text-xl font-bold text-gray-800 flex items-center gap-2 hover:text-blue-600 transition-colors text-left"
                aria-label="Edit camera name"
              >
                {name || (initialData ? 'Camera name' : 'Add New Camera')}
                <Edit2 size={16} className="text-gray-400" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close dialog"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mb-4 rounded-r-md">
            <p className="text-amber-800 text-sm font-medium">
              Warning: No ANPR camera locations are to be recorded on the registry.
              Only publicly visible, or publicly accessible cameras are to be added.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="bg-red-50 border-l-4 border-red-500 p-4 mb-4"
            >
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form id="add-camera-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="camera-type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Camera Type *
                </label>
                <select
                  id="camera-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as CameraType)}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="cctv">Retail CCTV</option>
                  <option value="police_council">Police / Council</option>
                  <option value="pfs">Petrol Filling Station (PFS)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="camera-owner"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Owner Name
                </label>
                <input
                  id="camera-owner"
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="camera-ref"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Police Reference Number
                </label>
                <input
                  id="camera-ref"
                  type="text"
                  value={policeReferenceNumber}
                  onChange={(e) => setPoliceReferenceNumber(e.target.value)}
                  placeholder="e.g. CAD 1234"
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="camera-address"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Camera Location Address
              </label>
              <input
                id="camera-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address…"
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">
                Location &amp; Direction
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-2 text-sm text-gray-600 bg-gray-100 p-2 rounded-md font-mono">
                  <span>Lat: {lat.toFixed(6)}</span>
                  <span>Lng: {lng.toFixed(6)}</span>
                </div>
                {onSetPosition && (
                  <button
                    type="button"
                    onClick={() =>
                      onSetPosition({
                        type,
                        name,
                        ownerName,
                        policeReferenceNumber,
                        address,
                        direction: direction === '' ? undefined : Number(direction),
                        fieldOfView:
                          fieldOfView === '' ? undefined : Number(fieldOfView),
                        viewDistance:
                          viewDistance === '' ? undefined : Number(viewDistance),
                      })
                    }
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 border border-red-700"
                  >
                    <Crosshair size={16} aria-hidden="true" />
                    Move Camera
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Click "Move Camera" to change the location or drag the red handle to
                aim it.
              </p>
            </div>

            {initialData?.createdAt && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Date Created
                  </span>
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-200">
                    {formatDateTime(initialData.createdAt)}
                  </div>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Last Verified
                  </span>
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-200">
                    {initialData.lastVerifiedAt
                      ? formatDateTime(initialData.lastVerifiedAt)
                      : 'Never'}
                  </div>
                </div>
              </div>
            )}

            {initialData?.creatorEmail && (
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">
                  Created By
                </span>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-200">
                  {initialData.creatorEmail}
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between gap-3">
          <div className="flex gap-2">
            {initialData && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-2 bg-red-100 text-red-700 font-medium hover:bg-red-200 rounded-md transition-colors flex items-center gap-1"
                title="Delete Camera"
              >
                <Trash2 size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            {initialData && onVerify && (
              <button
                type="button"
                onClick={onVerify}
                className="px-3 py-2 bg-green-100 text-green-700 font-medium hover:bg-green-200 rounded-md transition-colors flex items-center gap-1"
                title="Verify Active Today"
              >
                <CheckCircle size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Verify</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-md transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-camera-form"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2 disabled:opacity-70"
            >
              {isSaving ? (
                <span
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Save size={18} aria-hidden="true" />
              )}
              {initialData ? 'Update Camera' : 'Save Camera'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
