import { useMemo, useState } from 'react';
import { Camera } from '../types';
import {
  Video,
  Compass,
  MapPin,
  Search,
  Filter,
  Layers,
  ExternalLink,
  Radio,
  Car,
  X,
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface LiveDashboardProps {
  cameras: Camera[];
  onSelectOnMap: (camera: Camera) => void;
  onClose: () => void;
}

type LiveFeedKind = 'webcam' | 'traffic';

const COASTAL_HINTS = [
  'seafront',
  'beach',
  'pier',
  'lagoon',
  'marina',
  'watersports',
  'port',
  'harbour',
  'watercams',
  'i360',
];

export function getLiveCameraType(camera: Camera): LiveFeedKind {
  const name = (camera.name || '').toLowerCase();
  const url = (camera.publicOutputUrl || '').toLowerCase();
  const looksTraffic =
    name.includes('traffic') ||
    name.includes('road') ||
    name.includes('m23') ||
    name.includes('a23') ||
    name.includes('a27') ||
    name.includes('motorway') ||
    name.includes('incident') ||
    url.includes('traffic') ||
    camera.type === 'cctv';

  if (looksTraffic) {
    if (COASTAL_HINTS.some((hint) => name.includes(hint))) return 'webcam';
    return 'traffic';
  }
  return 'webcam';
}

export function getCameraArea(camera: Camera): string {
  const name = (camera.name || '').toLowerCase();
  const addr = (camera.address || '').toLowerCase();
  const has = (...needles: string[]) =>
    needles.some((n) => name.includes(n) || addr.includes(n));

  if (has('m23', 'a23', 'a27', 'incident', 'motorway')) return 'Roads & Motorways';
  if (has('brighton', 'hove')) return 'Brighton & Hove';
  if (has('worthing')) return 'Worthing';
  if (has('shoreham', 'southwick')) return 'Shoreham & Southwick';
  if (has('bognor', 'littlehampton', 'goring', 'strand')) {
    return 'Bognor & Littlehampton';
  }
  if (has('chichester', 'itchenor', 'fishbourne')) return 'Chichester';
  return 'Other Sussex';
}

const AREAS = [
  'Brighton & Hove',
  'Worthing',
  'Shoreham & Southwick',
  'Bognor & Littlehampton',
  'Chichester',
  'Roads & Motorways',
];

export default function LiveDashboard({
  cameras,
  onSelectOnMap,
  onClose,
}: LiveDashboardProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  const filteredCams = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return cameras
      .filter((cam) => !!cam.publicOutputUrl)
      .filter((cam) => {
        const matchesSearch =
          term === '' ||
          (cam.name || '').toLowerCase().includes(term) ||
          (cam.address || '').toLowerCase().includes(term) ||
          (cam.policeReferenceNumber || '').toLowerCase().includes(term);
        const matchesArea =
          selectedArea === 'all' || getCameraArea(cam) === selectedArea;
        const matchesType =
          selectedType === 'all' || getLiveCameraType(cam) === selectedType;
        return matchesSearch && matchesArea && matchesType;
      });
  }, [cameras, searchTerm, selectedArea, selectedType]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gray-900/95 z-[2500] flex flex-col text-gray-100 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-dashboard-title"
    >
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Radio size={24} className="animate-pulse" aria-hidden="true" />
          </div>
          <div>
            <h1
              id="live-dashboard-title"
              className="text-xl font-bold tracking-tight text-white"
            >
              Sussex Live Webcams &amp; Traffic Dashboard
            </h1>
            <p className="text-xs text-gray-400">
              Public feeds for surveillance verification ({filteredCams.length} feeds)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-semibold text-gray-200 transition-colors flex items-center gap-2"
        >
          <X size={16} aria-hidden="true" />
          Return to Map Registry
        </button>
      </header>

      <section className="bg-gray-800/50 border-b border-gray-700 p-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={18}
              aria-hidden="true"
            />
            <label htmlFor="live-search" className="sr-only">
              Search feeds
            </label>
            <input
              id="live-search"
              type="text"
              placeholder="Search by camera name, area, postcode or reference…"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" aria-hidden="true" />
            <label htmlFor="live-area" className="sr-only">
              Filter by area
            </label>
            <select
              id="live-area"
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="all">All Areas / Districts</option>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Layers size={16} className="text-gray-400" aria-hidden="true" />
            <label htmlFor="live-type" className="sr-only">
              Filter by feed type
            </label>
            <select
              id="live-type"
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">All Feed Types</option>
              <option value="webcam">Coastal / Beach Webcams</option>
              <option value="traffic">Roads &amp; Traffic Feeds</option>
            </select>
          </div>
        </div>
      </section>

      <main className="flex-1 overflow-y-auto p-6 w-full">
        <div className="max-w-7xl mx-auto">
          {filteredCams.length === 0 ? (
            <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
              <p className="text-gray-400 text-lg">
                No live feeds match your selected filters.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedArea('all');
                  setSelectedType('all');
                }}
                className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCams.map((cam) => {
                const isTraffic = getLiveCameraType(cam) === 'traffic';
                const area = getCameraArea(cam);
                return (
                  <div
                    key={cam.id}
                    className="bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-all flex flex-col overflow-hidden shadow-lg"
                  >
                    <div className="relative aspect-video bg-gray-950 flex flex-col items-center justify-center p-4 text-center border-b border-gray-700">
                      <div
                        className={`p-4 rounded-full mb-3 ${
                          isTraffic
                            ? 'bg-indigo-900/40 text-indigo-400'
                            : 'bg-emerald-900/40 text-emerald-400'
                        }`}
                      >
                        {isTraffic ? (
                          <Car size={32} aria-hidden="true" />
                        ) : (
                          <Video size={32} aria-hidden="true" />
                        )}
                      </div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {isTraffic ? 'Traffic feed' : 'Beach webcam'}
                      </h4>
                      <span
                        className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] uppercase font-extrabold tracking-wider shadow flex items-center gap-1 ${
                          isTraffic
                            ? 'bg-indigo-600 text-indigo-50 border border-indigo-500'
                            : 'bg-emerald-600 text-emerald-50 border border-emerald-500'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {isTraffic ? 'Traffic cam' : 'Live webcam'}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-white text-base leading-tight">
                          {cam.name || 'Unnamed camera'}
                        </h3>
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                          <MapPin
                            size={13}
                            className="shrink-0 text-gray-500"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {cam.address || 'Location information restricted'}
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                            {area}
                          </span>
                          {cam.policeReferenceNumber && (
                            <span className="bg-blue-900/30 text-blue-300 border border-blue-900/50 text-[10px] px-2 py-0.5 rounded-md font-mono font-bold">
                              Ref: {cam.policeReferenceNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-700">
                        <button
                          onClick={() => onSelectOnMap(cam)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-gray-600"
                        >
                          <Compass size={13} aria-hidden="true" />
                          Locate on Map
                        </button>
                        <a
                          href={cam.publicOutputUrl ?? undefined}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                        >
                          <ExternalLink size={13} aria-hidden="true" />
                          Open Feed
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
