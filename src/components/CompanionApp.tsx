import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Crosshair, Loader2, CheckCircle, ArrowLeft, LogOut } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Camera as CameraType } from '../types';
import { logEvent } from '../utils/eventLogger';
import { scanForPII } from '../utils/privacy';

interface CompanionAppProps {
  user: any;
  cameras: CameraType[];
  onSwitchMode: () => void;
  onLogout: () => void;
}

export default function CompanionApp({ user, cameras, onSwitchMode, onLogout }: CompanionAppProps) {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [type, setType] = useState<string>('cctv');
  const [policeRef, setPoliceRef] = useState('');
  const [publicOutputUrl, setPublicOutputUrl] = useState('');
  const [direction, setDirection] = useState<number | ''>('');

  const getLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        setLocationError(`Error getting location: ${error.message}`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      setLocationError('Please get your current location first');
      return;
    }

    // PII Scanner validation
    const refViolation = scanForPII(policeRef);
    if (refViolation) {
      setLocationError(`PII detected in Police Reference: ${refViolation}`);
      return;
    }

    const urlViolation = scanForPII(publicOutputUrl);
    if (urlViolation) {
      setLocationError(`PII detected in Public Output URL: ${urlViolation}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const cameraData: any = {
        type,
        latitude: location.lat,
        longitude: location.lng,
        addedBy: user.uid,
        creatorEmail: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (policeRef.trim()) cameraData.policeReferenceNumber = policeRef.trim();
      if (publicOutputUrl.trim()) cameraData.publicOutputUrl = publicOutputUrl.trim();
      if (direction !== '') cameraData.direction = Number(direction);

      await addDoc(collection(db, 'cameras'), cameraData);
      
      await logEvent('camera_added', user.uid, user.email, `Added camera via Companion at ${location.lat.toFixed(6)}&${location.lng.toFixed(6)}`);
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setLocation(null);
        setPoliceRef('');
        setPublicOutputUrl('');
        setDirection('');
      }, 3000);
    } catch (error: any) {
      setLocationError(`Failed to save camera: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={onSwitchMode} className="p-1 hover:bg-blue-600 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg">Quick Add Camera</h1>
        </div>
        <button onClick={onLogout} className="p-1 hover:bg-blue-600 rounded-full transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        {success ? (
          <div className="bg-green-100 border-2 border-green-500 rounded-xl p-8 text-center flex flex-col items-center justify-center h-64">
            <CheckCircle size={64} className="text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-green-800 mb-2">Camera Saved!</h2>
            <p className="text-green-600">The camera has been added to the registry.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-md">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Current Location</label>
              {location ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-800">
                    <MapPin size={18} />
                    <span className="text-sm font-medium">
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={getLocation}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Update
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={getLocation}
                  disabled={isLocating}
                  className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                >
                  {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Crosshair size={18} />}
                  Get GPS Location
                </button>
              )}
              {locationError && <p className="text-red-500 text-xs mt-1">{locationError}</p>}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Camera Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cctv">Retail CCTV</option>
                  <option value="police_council">Police/Council</option>
                  <option value="pfs">Petrol Station (PFS)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                  <span>Police Ref Number (Optional)</span>
                  <span className="text-xs text-blue-600 font-semibold font-sans">No PII</span>
                </label>
                <input
                  type="text"
                  value={policeRef}
                  onChange={(e) => setPoliceRef(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., CAD 1234 — Do not enter PII"
                />
                {scanForPII(policeRef) && (
                  <p className="text-xs text-red-600 mt-1 font-semibold">{scanForPII(policeRef)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                  <span>Public Output URL (Optional)</span>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 rounded">Sussex Public Cam</span>
                </label>
                <input
                  type="text"
                  value={publicOutputUrl}
                  onChange={(e) => setPublicOutputUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g. https://www.visitbrighton.com/webcam"
                />
                {scanForPII(publicOutputUrl) && (
                  <p className="text-xs text-red-600 mt-1 font-semibold">{scanForPII(publicOutputUrl)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direction (Optional)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="359"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="0-359 degrees"
                  />
                  <span className="text-gray-500 text-sm">°</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!location || isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg mt-8"
            >
              {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
              Save Camera
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
