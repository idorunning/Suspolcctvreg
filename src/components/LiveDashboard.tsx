import React, { useState } from 'react';
import { Camera } from '../types';
import { Video, Shield, Navigation, Compass, MapPin, Search, Filter, Play, RefreshCw, Layers, ExternalLink, Minimize2, Radio, Car } from 'lucide-react';

interface LiveDashboardProps {
  cameras: Camera[];
  onSelectOnMap: (camera: Camera) => void;
  onClose: () => void;
}

export const getLiveCameraType = (camera: Camera): 'webcam' | 'traffic' => {
  const name = (camera.name || '').toLowerCase();
  const url = (camera.publicOutputUrl || '').toLowerCase();
  if (
    name.includes('traffic') ||
    name.includes('road') ||
    name.includes('m23') ||
    name.includes('a23') ||
    name.includes('a27') ||
    name.includes('motorway') ||
    name.includes('incident') ||
    url.includes('traffic') ||
    camera.type === 'cctv'
  ) {
    if (
      name.includes('seafront') ||
      name.includes('beach') ||
      name.includes('pier') ||
      name.includes('lagoon') ||
      name.includes('marina') ||
      name.includes('watersports') ||
      name.includes('port') ||
      name.includes('harbour') ||
      name.includes('watercams') ||
      name.includes('i360')
    ) {
      return 'webcam';
    }
    return 'traffic';
  }
  return 'webcam';
};

export const getCameraArea = (camera: Camera): string => {
  const name = (camera.name || '').toLowerCase();
  const addr = (camera.address || '').toLowerCase();
  
  if (name.includes('m23') || name.includes('a23') || name.includes('a27') || name.includes('incident') || name.includes('motorway')) {
    return 'Roads & Motorways';
  }
  if (name.includes('brighton') || name.includes('hove') || addr.includes('brighton') || addr.includes('hove')) {
    return 'Brighton & Hove';
  }
  if (name.includes('worthing') || addr.includes('worthing')) {
    return 'Worthing';
  }
  if (name.includes('shoreham') || addr.includes('shoreham') || addr.includes('southwick')) {
    return 'Shoreham & Southwick';
  }
  if (name.includes('bognor') || name.includes('littlehampton') || addr.includes('bognor') || addr.includes('littlehampton') || addr.includes('goring') || addr.includes('strand')) {
    return 'Bognor & Littlehampton';
  }
  if (name.includes('chichester') || name.includes('itchenor') || name.includes('fishbourne') || addr.includes('chichester')) {
    return 'Chichester';
  }
  return 'Other Sussex';
};

export default function LiveDashboard({ cameras, onSelectOnMap, onClose }: LiveDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [playingFeeds, setPlayingFeeds] = useState<Record<string, boolean>>({});

  // Only consider cameras with a public feed
  const liveCams = cameras.filter(cam => !!cam.publicOutputUrl);

  const areas = ['all', 'Brighton & Hove', 'Worthing', 'Shoreham & Southwick', 'Bognor & Littlehampton', 'Chichester', 'Roads & Motorways'];

  const filteredCams = liveCams.filter(cam => {
    const camType = getLiveCameraType(cam);
    const camArea = getCameraArea(cam);

    const matchesSearch = 
      cam.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cam.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cam.policeReferenceNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesArea = selectedArea === 'all' || camArea === selectedArea;
    const matchesType = selectedType === 'all' || camType === selectedType;

    return matchesSearch && matchesArea && matchesType;
  });

  const togglePlay = (id: string) => {
    setPlayingFeeds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getCleanIframeUrl = (url: string): string => {
    if (url.includes('camsecure.co.uk/worthing_seafront_webcam.html')) {
      return 'https://camsecure.uk/httpswebcam/camsecure/worthingmarineparade.html';
    }
    if (url.includes('Shoreham_Port_Webcam.html') || url.includes('shoreham-port.co.uk/webcams')) {
      return 'https://camsecure.uk/httpswebcam/shorehamport/shorehamport.html';
    }
    if (url.includes('brighton-marina/webcam') || url.includes('Brighton_Harbour_Webcam.html')) {
      return 'https://camsecure.uk/httpswebcam/brightonmarina/brightonmarina.html';
    }
    if (url.includes('worthingsailingclub.co.uk/club/webcam')) {
      return 'https://camsecure.uk/httpswebcam/worthingsailing/worthingsailing.html';
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return url.replace('watch?v=', 'embed/').split('&')[0];
    }
    return url;
  };

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex flex-col font-sans text-gray-100 overflow-hidden">
      {/* Top Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Radio size={24} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Sussex Live Webcams & Traffic Dashboard
            </h1>
            <p className="text-xs text-gray-400">
              Interactive feeds monitor for police reference & surveillance verification ({filteredCams.length} feeds found)
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-semibold text-gray-200 transition-colors"
        >
          Return to Map Registry
        </button>
      </header>

      {/* Control / Filter Bar */}
      <section className="bg-gray-800/50 border-b border-gray-700/80 p-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by camera name, area, postcode or reference..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Area filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="all">All Areas / Districts</option>
              {areas.filter(a => a !== 'all').map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-gray-400" />
            <select
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">All Feed Types</option>
              <option value="webcam">Coastal / Beach Webcams</option>
              <option value="traffic">Roads & Traffic Feeds</option>
            </select>
          </div>
        </div>
      </section>

      {/* Feeds Grid */}
      <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        {filteredCams.length === 0 ? (
          <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
            <p className="text-gray-400 text-lg">No live feeds match your selected filters.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedArea('all'); setSelectedType('all'); }}
              className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCams.map(cam => {
              const isPlaying = !!playingFeeds[cam.id];
              const isTraffic = getLiveCameraType(cam) === 'traffic';
              const camArea = getCameraArea(cam);

              return (
                <div 
                  key={cam.id} 
                  className="bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-all flex flex-col overflow-hidden shadow-lg group"
                >
                  {/* Streaming Block */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-gray-700">
                    {isPlaying ? (
                      /\.(jpg|jpeg|png|webp|gif)/i.test(cam.publicOutputUrl || '') ? (
                        <img 
                          src={cam.publicOutputUrl} 
                          alt={cam.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <iframe
                          src={getCleanIframeUrl(cam.publicOutputUrl || '')}
                          title={cam.name}
                          className="w-full h-full border-0 absolute inset-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      )
                    ) : (
                      // Play overlay placeholder
                      <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center p-4 text-center">
                        <div className={`p-4 rounded-full mb-3 ${isTraffic ? 'bg-indigo-900/40 text-indigo-400' : 'bg-emerald-900/40 text-emerald-400'} group-hover:scale-105 transition-transform`}>
                          {isTraffic ? <Car size={32} /> : <Video size={32} />}
                        </div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                          {isTraffic ? 'Traffic feed' : 'Beach webcam'}
                        </h4>
                        <button
                          onClick={() => togglePlay(cam.id)}
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors text-sm"
                        >
                          <Play size={16} fill="currentColor" />
                          Play Camera Feed
                        </button>
                      </div>
                    )}

                    {isPlaying && (
                      <button
                        onClick={() => togglePlay(cam.id)}
                        className="absolute bottom-2 right-2 bg-gray-900/80 hover:bg-gray-900 text-white rounded p-1.5 text-xs font-semibold backdrop-blur-sm shadow border border-gray-700 flex items-center gap-1.5 z-10"
                        title="Stop/Close feed"
                      >
                        <Minimize2 size={12} />
                        Stop Feed
                      </button>
                    )}

                    {/* Badge */}
                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] uppercase font-extrabold tracking-wider shadow z-10 flex items-center gap-1 ${
                      isTraffic ? 'bg-indigo-600 text-indigo-50 border border-indigo-500' : 'bg-emerald-600 text-emerald-50 border border-emerald-500'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      {isTraffic ? 'Traffic cam' : 'Live webcam'}
                    </span>
                  </div>

                  {/* Desc Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-white text-base leading-tight ml-0.5">
                          {cam.name}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <MapPin size={13} className="shrink-0 text-gray-500" />
                        <span className="truncate">{cam.address || 'Location information restricted'}</span>
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                          {camArea}
                        </span>
                        {cam.policeReferenceNumber && (
                          <span className="bg-blue-900/30 text-blue-300 border border-blue-900/50 text-[10px] px-2 py-0.5 rounded-md font-mono font-bold">
                            Ref: {cam.policeReferenceNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-750">
                      <button
                        onClick={() => onSelectOnMap(cam)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-655 text-gray-200 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-gray-600"
                      >
                        <Compass size={13} />
                        Locate on Map
                      </button>
                      <a
                        href={cam.publicOutputUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                      >
                        <ExternalLink size={13} />
                        Open Original
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
