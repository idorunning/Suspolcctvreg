import { useMemo, useState } from 'react';
import type { Camera, CameraType, AreaFilter } from '../types';
import {
  Search, Plus, MapPin, Filter, Loader2, Cctv, Shield, Fuel, HelpCircle,
  Download, X, ChevronRight,
} from 'lucide-react';
import { isWithinRadius } from '../utils/geo';
import { exportAreaToCSV, exportToCSV } from '../utils/storage';

interface SidebarProps {
  cameras: Camera[];
  onSelectCamera: (camera: Camera) => void;
  onAddCameraClick: () => void;
  selectedCameraId?: string;
  onLocationFound?: (lat: number, lng: number) => void;
  area: AreaFilter | null;
  onClearArea: () => void;
}

const TYPE_LABEL: Record<CameraType, string> = {
  cctv: 'CCTV',
  police_council: 'Police / Council',
  pfs: 'Petrol',
  other: 'Other',
};

const TYPE_BG: Record<CameraType, string> = {
  cctv: 'bg-orange-500',
  police_council: 'bg-blue-600',
  pfs: 'bg-red-600',
  other: 'bg-slate-500',
};

function typeIcon(t: CameraType) {
  switch (t) {
    case 'cctv':
      return <Cctv size={14} className="text-white" />;
    case 'police_council':
      return <Shield size={14} className="text-white" fill="currentColor" />;
    case 'pfs':
      return <Fuel size={14} className="text-white" />;
    default:
      return <HelpCircle size={14} className="text-white" />;
  }
}

function formatRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export default function Sidebar({
  cameras,
  onSelectCamera,
  onAddCameraClick,
  selectedCameraId,
  onLocationFound,
  area,
  onClearArea,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | CameraType>('all');
  const [locationSearch, setLocationSearch] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return cameras.filter((c) => {
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (
        area &&
        !isWithinRadius(c.latitude, c.longitude, area.lat, area.lng, area.radiusM)
      )
        return false;
      if (term) {
        const hay = [c.name, c.address, c.policeReferenceNumber, c.addedBy, c.lastEditedBy]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [cameras, filterType, searchTerm, area]);

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = locationSearch.trim();
    if (!q) return;
    setIsSearchingLocation(true);
    setLocationError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) throw new Error('Search failed.');
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (!data.length) {
        setLocationError('Nothing found. Try a different search.');
        return;
      }
      onLocationFound?.(parseFloat(data[0].lat), parseFloat(data[0].lon));
    } catch {
      setLocationError('Search failed. Check your connection.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleExportAll = () => exportToCSV(cameras);
  const handleExportArea = () => {
    if (area) exportAreaToCSV(filtered, area);
  };

  return (
    <aside className="w-80 bg-white border-r border-slate-200 h-full flex flex-col">
      <div className="p-4 space-y-3 border-b border-slate-100">
        <button
          type="button"
          onClick={onAddCameraClick}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          Add a camera
        </button>

        <form onSubmit={handleSearchLocation} className="space-y-2">
          <label htmlFor="loc-search" className="sr-only">
            Search for a place
          </label>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <MapPin
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="loc-search"
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Find a place (e.g. Brighton)"
                className="w-full border border-slate-300 rounded-lg py-1.5 pl-8 pr-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingLocation}
              className="px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {isSearchingLocation ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Go'
              )}
            </button>
          </div>
          {locationError && <p className="text-xs text-red-700">{locationError}</p>}
        </form>
      </div>

      {area && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-blue-900">
              In the chosen area ({formatRadius(area.radiusM)})
            </p>
            <button
              type="button"
              onClick={onClearArea}
              aria-label="Clear area filter"
              className="text-blue-800 hover:bg-blue-100 p-1 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-blue-800 text-xs">
            {filtered.length} {filtered.length === 1 ? 'camera' : 'cameras'} found
          </p>
          <button
            type="button"
            onClick={handleExportArea}
            disabled={filtered.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
          >
            <Download size={14} aria-hidden="true" />
            Export this area (CSV)
          </button>
        </div>
      )}

      <div className="px-4 pt-3 pb-2 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
          <label htmlFor="cam-search" className="sr-only">
            Search cameras
          </label>
          <input
            id="cam-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search cameras"
            className="w-full border border-slate-300 rounded-lg py-1.5 pl-8 pr-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
          <label htmlFor="cam-type-filter" className="sr-only">
            Camera type
          </label>
          <select
            id="cam-type-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | CameraType)}
            className="border border-slate-300 rounded-lg py-1.5 pl-8 pr-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All types</option>
            <option value="cctv">CCTV</option>
            <option value="police_council">Police / Council</option>
            <option value="pfs">Petrol</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 px-3 py-6 text-center">
            No cameras match.
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((c) => {
              const selected = selectedCameraId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCamera(c)}
                    aria-current={selected ? 'true' : undefined}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 border transition-colors ${
                      selected
                        ? 'bg-blue-50 border-blue-300'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`${TYPE_BG[c.type]} text-white rounded-full p-1.5 flex items-center justify-center flex-shrink-0`}
                      aria-hidden="true"
                    >
                      {typeIcon(c.type)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-slate-900 truncate block text-sm">
                        {c.name || TYPE_LABEL[c.type]}
                      </span>
                      <span className="text-xs text-slate-500 truncate block">
                        {c.address || `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`}
                      </span>
                    </span>
                    <ChevronRight size={14} className="text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={handleExportAll}
          className="w-full text-sm bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
        >
          <Download size={14} aria-hidden="true" />
          Export all ({cameras.length})
        </button>
      </div>
    </aside>
  );
}
