import { useEffect, useMemo } from 'react';
import { Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { AreaFilter } from '../types';
import { calculateDestination, calculateDistance } from '../utils/geo';

interface AreaSelectorLayerProps {
  area: AreaFilter | null;
  setArea: (area: AreaFilter | null) => void;
  active: boolean;
  setActive: (active: boolean) => void;
}

const HANDLE_ICON = L.divIcon({
  className: 'area-handle',
  html:
    '<div style="width:18px;height:18px;border-radius:50%;background:#dc2626;border:3px solid white;box-shadow:0 0 0 1px #991b1b;"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function AreaSelectorLayer({
  area,
  setArea,
  active,
  setActive,
}: AreaSelectorLayerProps) {
  useMapEvents({
    click(e) {
      if (!active) return;
      if (!area) {
        // First click sets centre with a sensible default radius.
        setArea({ lat: e.latlng.lat, lng: e.latlng.lng, radiusM: 250 });
      } else {
        // Second click resizes radius from existing centre, then finishes the gesture.
        const radius = calculateDistance(area.lat, area.lng, e.latlng.lat, e.latlng.lng);
        setArea({ ...area, radiusM: Math.max(20, Math.round(radius)) });
        setActive(false);
      }
    },
  });

  // ESC cancels active draw mode without clearing an existing area.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, setActive]);

  const handlePos = useMemo(() => {
    if (!area) return null;
    return calculateDestination(area.lat, area.lng, 90, area.radiusM);
  }, [area]);

  if (!area) return null;

  return (
    <>
      <Circle
        center={[area.lat, area.lng]}
        radius={area.radiusM}
        pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.08, weight: 2 }}
      />
      {handlePos && (
        <Marker
          position={handlePos}
          draggable
          icon={HANDLE_ICON}
          eventHandlers={{
            drag: (e) => {
              const m = e.target as L.Marker;
              const { lat, lng } = m.getLatLng();
              const r = calculateDistance(area.lat, area.lng, lat, lng);
              setArea({ ...area, radiusM: Math.max(20, Math.round(r)) });
            },
          }}
        />
      )}
    </>
  );
}
