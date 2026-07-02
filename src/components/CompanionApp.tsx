import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle, Crosshair, Cctv, Fuel, HelpCircle, Loader2, Shield, Compass } from 'lucide-react';
import type { CameraType } from '../types';
import { createCamera } from '../services/localApi';
import { scanForPII } from '../utils/privacy';
import { getStoredInitials, normalizeInitials, storeInitials } from '../utils/initials';

interface CompanionAppProps {
  onSwitchMode: () => void;
}

type Stage = 'locating' | 'form' | 'saving' | 'saved' | 'error';

const TYPES: { id: CameraType; label: string; Icon: typeof Cctv; bg: string }[] = [
  { id: 'cctv', label: 'CCTV', Icon: Cctv, bg: 'bg-orange-500' },
  { id: 'police_council', label: 'Police / Council', Icon: Shield, bg: 'bg-blue-600' },
  { id: 'pfs', label: 'Petrol', Icon: Fuel, bg: 'bg-red-600' },
  { id: 'other', label: 'Other', Icon: HelpCircle, bg: 'bg-slate-500' },
];

interface DeviceOrientationEventWithRequest extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

export default function CompanionApp({ onSwitchMode }: CompanionAppProps) {
  const [stage, setStage] = useState<Stage>('locating');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<CameraType>('cctv');
  const [direction, setDirection] = useState<number>(0);
  const [note, setNote] = useState('');
  const [initials, setInitials] = useState(() => getStoredInitials());
  const compassHandlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  // Auto-fetch geolocation on mount.
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('This device cannot share its location.');
      setStage('error');
      return;
    }
    const id = navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStage('form');
      },
      (err) => {
        setError(err.code === 1 ? 'Allow location and try again.' : 'We couldn\'t find your location. Try moving outside.');
        setStage('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    return () => {
      if (typeof id === 'number') navigator.geolocation.clearWatch(id);
    };
  }, []);

  const retryLocation = () => {
    setError(null);
    setStage('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStage('form');
      },
      () => {
        setError('Still no location. Try outside or near a window.');
        setStage('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const useCompass = async () => {
    type DOE = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    const Ctor = DeviceOrientationEvent as DOE;
    try {
      if (typeof Ctor.requestPermission === 'function') {
        const res = await Ctor.requestPermission();
        if (res !== 'granted') return;
      }
    } catch {
      return;
    }
    if (compassHandlerRef.current) {
      window.removeEventListener('deviceorientation', compassHandlerRef.current);
    }
    const handler = (e: DeviceOrientationEvent) => {
      const ev = e as DeviceOrientationEventWithRequest;
      const heading = ev.webkitCompassHeading ?? (typeof ev.alpha === 'number' ? 360 - ev.alpha : null);
      if (heading != null && !isNaN(heading)) {
        setDirection(Math.round(heading) % 360);
      }
    };
    compassHandlerRef.current = handler;
    window.addEventListener('deviceorientation', handler, true);
    // Auto-detach after a short window so a one-tap reading captures.
    setTimeout(() => {
      window.removeEventListener('deviceorientation', handler, true);
      compassHandlerRef.current = null;
    }, 2000);
  };

  const handleSave = async () => {
    if (!location) return;
    const violation = scanForPII(note);
    if (violation) {
      setError(`Note: ${violation}`);
      return;
    }
    if (initials.trim() === '') {
      setError('Your initials are required.');
      return;
    }
    setStage('saving');
    setError(null);
    try {
      storeInitials(initials);
      await createCamera(
        {
          type,
          latitude: location.lat,
          longitude: location.lng,
          name: note.trim() || null,
          direction: direction,
        },
        initials.trim() || null,
      );
      setStage('saved');
      setTimeout(() => {
        setStage('locating');
        setLocation(null);
        setNote('');
        setDirection(0);
        retryLocation();
      }, 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setStage('form');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-blue-700 text-white p-4 flex items-center justify-between shadow">
        <button
          type="button"
          onClick={onSwitchMode}
          aria-label="Back to map"
          className="p-2 hover:bg-blue-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">Quick add</h1>
        <span className="w-9" aria-hidden="true" />
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4">
        {stage === 'locating' && (
          <div className="bg-white rounded-2xl p-8 shadow flex flex-col items-center gap-4 mt-8">
            <Loader2 size={48} className="text-blue-600 animate-spin" aria-hidden="true" />
            <p className="font-medium text-slate-700">Locating you…</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="bg-white rounded-2xl p-6 shadow space-y-3 mt-8">
            <p className="text-red-700">{error ?? 'Something went wrong.'}</p>
            <button
              type="button"
              onClick={retryLocation}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl"
            >
              Try again
            </button>
          </div>
        )}

        {stage === 'saved' && (
          <div
            role="status"
            className="bg-green-50 border-2 border-green-500 rounded-2xl p-8 text-center flex flex-col items-center mt-8"
          >
            <CheckCircle size={64} className="text-green-600 mb-3" aria-hidden="true" />
            <h2 className="text-xl font-bold text-green-800">Camera added</h2>
            <p className="text-green-700 text-sm mt-1">Getting ready for the next one…</p>
          </div>
        )}

        {(stage === 'form' || stage === 'saving') && location && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow flex items-center gap-2">
              <Crosshair size={18} className="text-blue-700" aria-hidden="true" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Your location</p>
                <p className="font-mono text-sm text-slate-800">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow">
              <p className="text-sm font-medium text-slate-700 mb-2">What kind of camera?</p>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(({ id, label, Icon, bg }) => {
                  const active = type === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setType(id)}
                      aria-pressed={active}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-4 border-2 transition-colors font-medium ${
                        active
                          ? 'border-blue-700 bg-blue-50 text-blue-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span
                        className={`${bg} text-white rounded-full p-2 flex items-center justify-center`}
                        aria-hidden="true"
                      >
                        <Icon size={20} />
                      </span>
                      <span className="text-sm">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="flex items-center justify-between">
                <label htmlFor="qa-direction" className="text-sm font-medium text-slate-700">
                  Which way does it point?
                </label>
                <span className="text-sm font-mono text-slate-600">{direction}°</span>
              </div>
              <input
                id="qa-direction"
                type="range"
                min={0}
                max={359}
                value={direction}
                onChange={(e) => setDirection(Number(e.target.value))}
                className="w-full mt-2 accent-blue-700"
              />
              <div className="mt-3 flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <div
                    style={{ transform: `rotate(${direction}deg)`, transformOrigin: '50% 50%' }}
                    className="absolute inset-0 flex items-start justify-center pt-1"
                    aria-hidden="true"
                  >
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[16px] border-b-red-600" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={useCompass}
                  className="inline-flex items-center gap-2 text-sm bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg border border-slate-300 text-slate-700"
                >
                  <Compass size={16} aria-hidden="true" />
                  Use phone compass
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow">
              <label htmlFor="qa-note" className="block text-sm font-medium text-slate-700 mb-1">
                Short note (optional)
              </label>
              <input
                id="qa-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Bus stop shelter"
                className="w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">No names or addresses please.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow">
              <label htmlFor="qa-initials" className="block text-sm font-medium text-slate-700 mb-1">
                Your initials
              </label>
              <input
                id="qa-initials"
                type="text"
                value={initials}
                onChange={(e) => setInitials(normalizeInitials(e.target.value))}
                placeholder="e.g. NT"
                maxLength={6}
                className="w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={stage === 'saving'}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-60 text-lg flex items-center justify-center gap-2"
            >
              {stage === 'saving' ? (
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle size={20} aria-hidden="true" />
              )}
              Save camera
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
