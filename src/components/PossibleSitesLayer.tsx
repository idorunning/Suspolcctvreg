import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { Fuel, ShoppingCart, Cctv, AlertCircle } from 'lucide-react';

export type PossibleSiteKind = 'fuel' | 'supermarket' | 'public_cctv';

export interface PossibleSite {
  id: string;
  kind: PossibleSiteKind;
  name: string;
  brand?: string;
  lat: number;
  lng: number;
}

interface PossibleSitesLayerProps {
  enabled: boolean;
  onAddCamera: (site: PossibleSite) => void;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const COLOURS: Record<PossibleSiteKind, string> = {
  fuel: '#f97316',
  supermarket: '#0ea5e9',
  public_cctv: '#6b7280',
};

const LABELS: Record<PossibleSiteKind, string> = {
  fuel: 'Petrol station',
  supermarket: 'Supermarket',
  public_cctv: 'Existing public CCTV',
};

function buildQuery(b: { south: number; west: number; north: number; east: number }): string {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  return `
    [out:json][timeout:25];
    (
      node[amenity=fuel](${bbox});
      node[shop=supermarket](${bbox});
      node[shop=convenience][brand~"Tesco|Sainsbury|Asda|Morrisons|Aldi|Lidl|Co-op|Coop|Iceland|Waitrose|M&S",i](${bbox});
      node[man_made=surveillance][surveillance:type=camera](${bbox});
    );
    out body 500;
  `;
}

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

function classify(tags: Record<string, string> | undefined): PossibleSiteKind | null {
  if (!tags) return null;
  if (tags['amenity'] === 'fuel') return 'fuel';
  if (tags['shop'] === 'supermarket') return 'supermarket';
  if (tags['shop'] === 'convenience' && tags['brand']) return 'supermarket';
  if (tags['man_made'] === 'surveillance') return 'public_cctv';
  return null;
}

async function fetchOverpass(query: string, signal: AbortSignal): Promise<OverpassNode[]> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal,
      });
      if (!res.ok) continue;
      const json = await res.json();
      return (json.elements ?? []).filter((e: { type: string }) => e.type === 'node');
    } catch {
      // try next mirror
    }
  }
  throw new Error('Overpass query failed.');
}

export default function PossibleSitesLayer({ enabled, onAddCamera }: PossibleSitesLayerProps) {
  const map = useMap();
  const [sites, setSites] = useState<PossibleSite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastBoundsKey = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = (bounds: LatLngBoundsExpression) => {
    if (!enabled) return;
    const b = (bounds as L.LatLngBounds).pad ? (bounds as L.LatLngBounds) : null;
    if (!b) return;
    const south = b.getSouth();
    const west = b.getWest();
    const north = b.getNorth();
    const east = b.getEast();
    const key = `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
    if (key === lastBoundsKey.current) return;
    lastBoundsKey.current = key;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    fetchOverpass(buildQuery({ south, west, north, east }), ctrl.signal)
      .then((nodes) => {
        const out: PossibleSite[] = [];
        for (const n of nodes) {
          const kind = classify(n.tags);
          if (!kind) continue;
          out.push({
            id: `${n.id}`,
            kind,
            name: n.tags?.['name'] || LABELS[kind],
            brand: n.tags?.['brand'],
            lat: n.lat,
            lng: n.lon,
          });
        }
        setSites(out);
      })
      .catch((e) => {
        if ((e as { name?: string }).name !== 'AbortError') {
          setError('Could not load possible sites.');
        }
      })
      .finally(() => setLoading(false));
  };

  useMapEvents({
    moveend() {
      refresh(map.getBounds());
    },
  });

  useEffect(() => {
    if (enabled) refresh(map.getBounds());
    else {
      abortRef.current?.abort();
      setSites([]);
      lastBoundsKey.current = null;
    }
    // Re-run only when toggled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const grouped = useMemo(() => sites, [sites]);

  if (!enabled) return null;

  return (
    <>
      {error && (
        <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none' }}>
          <div
            role="alert"
            style={{
              background: 'rgba(254,242,242,0.95)',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '6px 10px',
              borderRadius: 8,
              margin: 8,
              fontSize: 12,
              pointerEvents: 'auto',
            }}
          >
            <AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {error}
          </div>
        </div>
      )}
      {loading && (
        <div className="leaflet-bottom leaflet-right" style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(15,23,42,0.85)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 8,
              margin: 8,
              fontSize: 11,
            }}
          >
            Loading possible sites…
          </div>
        </div>
      )}
      {grouped.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={6}
          pathOptions={{
            color: COLOURS[s.kind],
            fillColor: COLOURS[s.kind],
            fillOpacity: 0.6,
            weight: 2,
            dashArray: '3 3',
          }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                {s.kind === 'fuel' ? (
                  <>
                    <Fuel size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                    Petrol
                  </>
                ) : s.kind === 'supermarket' ? (
                  <>
                    <ShoppingCart size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                    Supermarket
                  </>
                ) : (
                  <>
                    <Cctv size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                    Existing CCTV
                  </>
                )}
              </p>
              <p style={{ margin: '4px 0', fontWeight: 600 }}>{s.name}</p>
              {s.brand && (
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#475569' }}>{s.brand}</p>
              )}
              <button
                type="button"
                onClick={() => onAddCamera(s)}
                style={{
                  background: '#1d4ed8',
                  color: 'white',
                  border: 0,
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Add this as a camera
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
