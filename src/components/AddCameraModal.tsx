import React, { useState, useEffect } from 'react';
import { Camera, CameraType } from '../types';
import { X, Save, Crosshair, Edit2, Camera as CameraIcon, Video, Shield, Fuel, HelpCircle, ChevronDown, Cctv, Trash2, CheckCircle, ShieldAlert, EyeOff } from 'lucide-react';
import { scanForPII } from '../utils/privacy';

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

const PoliceCameraIcon = ({ size, className }: { size: number, className?: string }) => (
  <Shield size={size} className={className} fill="currentColor" />
);

export default function AddCameraModal({ lat, lng, onClose, onSave, initialData, draftDirection, draftDistance, onDirectionChange, onSetPosition, onDelete, onVerify }: AddCameraModalProps) {
  const [type, setType] = useState<CameraType>(initialData?.type || 'cctv');
  const [name, setName] = useState(initialData?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [policeReferenceNumber, setPoliceReferenceNumber] = useState(initialData?.policeReferenceNumber || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [direction, setDirection] = useState<number | ''>(initialData?.direction ?? (draftDirection ?? ''));
  const [fieldOfView, setFieldOfView] = useState<number | ''>(initialData?.fieldOfView ?? 90);
  const [viewDistance, setViewDistance] = useState<number | ''>(initialData?.viewDistance ?? (draftDistance ?? 30));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const cameraTypes = [
    { id: 'cctv', label: 'Retail CCTV', icon: <Cctv size={18} className="text-orange-500" /> },
    { id: 'police_council', label: 'Police/Council', icon: <PoliceCameraIcon size={18} className="text-blue-600" /> },
    { id: 'pfs', label: 'Petrol Filling Station (PFS)', icon: <Fuel size={18} className="text-orange-600" /> },
    { id: 'other', label: 'Other', icon: <HelpCircle size={18} className="text-gray-600" /> },
  ];

  const selectedTypeObj = cameraTypes.find(t => t.id === type) || cameraTypes[0];

  // Sync direction state if it changes from outside (e.g., dragging the handle)
  useEffect(() => {
    if (draftDirection !== undefined) {
      setDirection(draftDirection);
    }
    if (draftDistance !== undefined) {
      setViewDistance(draftDistance);
    }
  }, [draftDirection, draftDistance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    // Scan for PII in all textual inputs
    const namePiiViolation = scanForPII(name);
    if (namePiiViolation) {
      setError(`PII detected in Camera Name: ${namePiiViolation}`);
      setIsSaving(false);
      return;
    }

    const refPiiViolation = scanForPII(policeReferenceNumber);
    if (refPiiViolation) {
      setError(`PII detected in Police Reference: ${refPiiViolation}`);
      setIsSaving(false);
      return;
    }

    const addressPiiViolation = scanForPII(address);
    if (addressPiiViolation) {
      setError(`PII detected in Location Address: ${addressPiiViolation}`);
      setIsSaving(false);
      return;
    }

    try {
      await onSave({
        type,
        name: name.trim() === '' ? undefined : name,
        policeReferenceNumber: policeReferenceNumber.trim() === '' ? undefined : policeReferenceNumber,
        address: address.trim() === '' ? undefined : address,
        latitude: lat,
        longitude: lng,
        direction: direction === '' ? undefined : Number(direction),
        fieldOfView: fieldOfView === '' ? undefined : Number(fieldOfView),
        viewDistance: viewDistance === '' ? undefined : Number(viewDistance),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save camera');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 pointer-events-none select-none">
      <div className="bg-white rounded-2xl border border-slate-205 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] pointer-events-auto mt-auto mb-4 sm:my-auto">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              {initialData ? <CameraIcon size={18} /> : <Crosshair size={18} />}
            </div>
            {isEditingName ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                className="text-base font-bold font-display text-slate-900 bg-white border border-blue-300 rounded-xl px-2.5 py-1.5 w-full max-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-600/10"
                placeholder="Camera name"
              />
            ) : (
              <h2 className="text-base font-bold font-display text-slate-950 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setIsEditingName(true)}>
                {name || (initialData ? 'Camera name' : 'Add New Camera')}
                <Edit2 size={13} className="text-slate-400 hover:text-blue-600" />
              </h2>
            )}
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="bg-blue-50/75 border border-blue-100 p-4 rounded-xl flex gap-3 items-start">
            <EyeOff size={18} className="text-blue-600 mt-0.5 flex-shrink-0 stroke-[2]" />
            <div>
              <p className="text-blue-900 text-xs font-bold font-display uppercase tracking-wider">Privacy-First Registry Policy</p>
              <p className="text-blue-750 text-[11px] mt-1 leading-relaxed">
                Recording Personally Identifiable Information (PII) is strictly prohibited. Do not enter names, personal contact numbers, flat numbers, or private home numbers.
              </p>
            </div>
          </div>

          <div className="bg-amber-50/80 border border-amber-100 p-4 rounded-xl">
            <p className="text-amber-850 text-[11px] leading-relaxed font-medium">
              ⚠️ <strong>Notice:</strong> ANPR tracking or automated license scanners are barred from this register. Log only standard viewable or public security reference points.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-2.5">
              <ShieldAlert size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-xs font-semibold leading-relaxed">{error}</p>
            </div>
          )}

          <form id="add-camera-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Camera Type *</label>
                <div 
                  className="w-full border border-slate-200 rounded-xl py-2 px-3.5 bg-white cursor-pointer flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-650/10 hover:border-slate-300 transition-all text-xs font-semibold text-slate-800"
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                >
                  <div className="flex items-center gap-2">
                    {selectedTypeObj.icon}
                    <span>{selectedTypeObj.label}</span>
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </div>
                
                {isTypeDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1">
                    {cameraTypes.map((camType) => (
                      <div
                        key={camType.id}
                        className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-950 transition-colors"
                        onClick={() => {
                          setType(camType.id as CameraType);
                          setIsTypeDropdownOpen(false);
                        }}
                      >
                        {camType.icon}
                        <span>{camType.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Police Reference Number</label>
                <input
                  type="text"
                  value={policeReferenceNumber}
                  onChange={(e) => setPoliceReferenceNumber(e.target.value)}
                  placeholder="e.g. CAD 1234 (Optional)"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all font-sans text-slate-900 placeholder-slate-400"
                />
                {scanForPII(policeReferenceNumber) && (
                  <p className="text-[10px] text-red-650 mt-1 font-semibold">⚠️ {scanForPII(policeReferenceNumber)}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Location Landmark / Junction Address</label>
                <span className="text-[9px] uppercase font-mono font-bold text-blue-600 bg-blue-50/50 border border-blue-100 rounded px-1">PII Shield On</span>
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Junction of High St & York Rd, outside pharmacy — No house numbers"
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all font-sans text-slate-900 placeholder-slate-400"
              />
              {scanForPII(address) ? (
                <p className="text-[10px] text-red-650 mt-1 font-semibold">⚠️ {scanForPII(address)}</p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-relaxed">Provide crossroads or public landmark descriptors. Avoid private residence numbers or names.</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Location & Direction</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-3 text-[11px] text-slate-750 bg-slate-100 border border-slate-200/60 p-2.5 rounded-xl font-mono font-semibold">
                  <span>Lat: {lat.toFixed(6)}</span>
                  <span>Lng: {lng.toFixed(6)}</span>
                </div>
                {onSetPosition && (
                  <button
                    type="button"
                    onClick={() => onSetPosition({
                      type, name, policeReferenceNumber, address,
                      direction: direction === '' ? undefined : Number(direction),
                      fieldOfView: fieldOfView === '' ? undefined : Number(fieldOfView),
                      viewDistance: viewDistance === '' ? undefined : Number(viewDistance)
                    })}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crosshair size={13} />
                    Move Node
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-normal">Drag the coordinate indicator handle on the central map to dial in precise bearings.</p>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coverage Cone Adjustments</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Direction Angle</label>
                    <span className="text-xs font-mono text-blue-600 font-bold">{direction !== '' ? `${direction}°` : 'Off'}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={direction === '' ? 0 : direction}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDirection(val);
                      if (onDirectionChange) onDirectionChange(val);
                    }}
                    className="w-full accent-blue-650 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Estimated Range</label>
                    <span className="text-xs font-mono text-blue-600 font-bold">{viewDistance !== '' ? `${viewDistance}m` : 'Off'}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="200"
                    value={viewDistance === '' ? 30 : viewDistance}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setViewDistance(val);
                    }}
                    className="w-full accent-blue-650 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Visual Range Arc (FoV)</label>
                  <span className="text-xs font-mono text-blue-600 font-bold">{fieldOfView !== '' ? `${fieldOfView}° field` : 'Off'}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="180"
                  value={fieldOfView === '' ? 90 : fieldOfView}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFieldOfView(val);
                  }}
                  className="w-full accent-blue-650 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                />
              </div>
            </div>

            {initialData?.createdAt && (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Created</label>
                  <div className="text-slate-700 font-mono bg-slate-50 p-2 border border-slate-150 rounded-xl">
                    {initialData.createdAt?.toDate ? initialData.createdAt.toDate().toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Last verified</label>
                  <div className="text-slate-700 font-mono bg-slate-50 p-2 border border-slate-150 rounded-xl">
                    {initialData.lastVerifiedAt?.toDate ? initialData.lastVerifiedAt.toDate().toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </div>
            )}

            {initialData?.creatorEmail && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Created by</label>
                <div className="text-slate-700 bg-slate-50 p-2.5 border border-slate-150 rounded-xl text-xs font-medium">
                  {initialData.creatorEmail}
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="p-4 border-t border-slate-200/60 bg-slate-50/70 flex justify-between gap-3 flex-shrink-0">
          <div className="flex gap-2">
            {initialData && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl text-xs font-semibold transition-all border border-red-150 flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Delete Camera"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete Node</span>
              </button>
            )}
            {initialData && onVerify && (
              <button
                type="button"
                onClick={onVerify}
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition-all border border-emerald-150 flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Verify Active Today"
              >
                <CheckCircle size={13} />
                <span className="hidden sm:inline">Verify Active</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-camera-form"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-70 shadow-md shadow-blue-600/10 cursor-pointer select-none"
            >
              {isSaving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Save size={13} />
              )}
              {initialData ? 'Update Node' : 'Register Node'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
