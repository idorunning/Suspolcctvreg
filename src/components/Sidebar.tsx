import React, { useState } from 'react';
import { Camera, User } from '../types';
import { Search, Plus, MapPin, Filter, Navigation, Loader2, Camera as CameraIcon, Video, Shield, Fuel, HelpCircle, ChevronDown, ChevronRight, Download, Cctv, ExternalLink, Play, Car } from 'lucide-react';

const getLiveCameraType = (camera: Camera): 'webcam' | 'traffic' => {
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

interface SidebarProps {
  cameras: Camera[];
  onSelectCamera: (camera: Camera) => void;
  onAddCameraClick: () => void;
  selectedCameraId?: string;
  onLocationFound?: (lat: number, lng: number) => void;
  canAdd?: boolean;
}

const PoliceCameraIcon = ({ size, className }: { size: number, className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
    <CameraIcon size={size} />
    <Shield size={size * 0.5} className="absolute -bottom-1 -right-1 text-blue-800 bg-white rounded-full" fill="currentColor" />
  </div>
);

export default function Sidebar({ cameras, onSelectCamera, onAddCameraClick, selectedCameraId, onLocationFound, canAdd = true }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [playingCameras, setPlayingCameras] = useState<Record<string, boolean>>({});
  
  const [locationSearch, setLocationSearch] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isPrimaryMenuOpen, setIsPrimaryMenuOpen] = useState(true);
  const [isCameraListOpen, setIsCameraListOpen] = useState(true);

  const filterTypes = [
    { id: 'all', label: 'All Types', icon: <Filter size={16} className="text-gray-500" /> },
    { id: 'live', label: 'Live Cameras / Feeds', icon: <Video size={16} className="text-emerald-600" /> },
    { id: 'cctv', label: 'Retail CCTV', icon: <Cctv size={16} className="text-orange-500" /> },
    { id: 'police_council', label: 'Police/Council', icon: <PoliceCameraIcon size={16} className="text-blue-600" /> },
    { id: 'pfs', label: 'Petrol Filling Station (PFS)', icon: <Fuel size={16} className="text-orange-600" /> },
    { id: 'other', label: 'Other', icon: <HelpCircle size={16} className="text-gray-600" /> },
  ];

  const selectedFilterObj = filterTypes.find(t => t.id === filterType) || filterTypes[0];

  const filteredCameras = cameras.filter(camera => {
    const matchesSearch = 
      camera.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      camera.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      camera.policeReferenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      camera.publicOutputUrl?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((searchTerm.toLowerCase() === 'live' || searchTerm.toLowerCase() === 'public' || searchTerm.toLowerCase() === 'feed' || searchTerm.toLowerCase() === 'webcam') && !!camera.publicOutputUrl);
      
    const matchesType = filterType === 'all' || (filterType === 'live' ? !!camera.publicOutputUrl : camera.type === filterType);
    
    return matchesSearch && matchesType;
  });

  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationSearch.trim() || !onLocationFound) return;
    
    setIsSearchingLocation(true);
    setLocationError('');
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}&countrycodes=gb&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        onLocationFound(parseFloat(lat), parseFloat(lon));
      } else {
        setLocationError('Location not found');
      }
    } catch (err) {
      setLocationError('Error searching location');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleExportData = () => {
    if (cameras.length === 0) return;
    
    const headers = ['ID', 'Type', 'Name', 'Address', 'Police Reference', 'Latitude', 'Longitude', 'Direction', 'Field of View', 'View Distance', 'Added By', 'Creator Email', 'Created At', 'Last Verified At'];
    
    const csvRows = [
      headers.join(','),
      ...cameras.map(c => {
        const createdAt = c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : '';
        const lastVerifiedAt = c.lastVerifiedAt?.toDate ? c.lastVerifiedAt.toDate().toISOString() : '';
        
        return [
          c.id,
          c.type,
          `"${(c.name || '').replace(/"/g, '""')}"`,
          `"${(c.address || '').replace(/"/g, '""')}"`,
          `"${(c.policeReferenceNumber || '').replace(/"/g, '""')}"`,
          c.latitude,
          c.longitude,
          c.direction !== undefined ? c.direction : '',
          c.fieldOfView !== undefined ? c.fieldOfView : '',
          c.viewDistance !== undefined ? c.viewDistance : '',
          c.addedBy,
          c.creatorEmail,
          createdAt,
          lastVerifiedAt
        ].join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sussex_cameras_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-80 h-full bg-white border-r border-gray-200 flex flex-col shadow-xl z-10 relative">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 bg-blue-900 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <MapPin size={24} className="text-blue-300" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Sussex Camera Registry</h1>
            <p className="text-xs text-blue-200">Authorized Police Registry</p>
          </div>
        </div>
      </div>

      {/* Primary Menu Toggle */}
      <div 
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors flex-shrink-0"
        onClick={() => setIsPrimaryMenuOpen(!isPrimaryMenuOpen)}
      >
        <h2 className="text-xs font-bold text-gray-550 text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <Filter size={14} />
          Location & Filters
        </h2>
        {isPrimaryMenuOpen ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
      </div>

      {isPrimaryMenuOpen && (
        <div className="p-4 border-b border-gray-200 bg-white space-y-4 flex-shrink-0">
          <form onSubmit={handleLocationSearch} className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Jump to Location</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Navigation className="absolute left-3 top-2.5 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Postcode, town, street..."
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                disabled={isSearchingLocation || !locationSearch.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center min-w-[40px]"
              >
                {isSearchingLocation ? <Loader2 size={16} className="animate-spin" /> : 'Go'}
              </button>
            </div>
            {locationError && <p className="text-xs text-red-650 font-medium pl-1">⚠️ {locationError}</p>}
          </form>

          <div className="pt-3 border-t border-gray-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search coordinates, names, refs, link..."
                className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <div 
                className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm bg-white cursor-pointer flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              >
                <div className="flex items-center gap-2">
                  {selectedFilterObj.icon}
                  <span>{selectedFilterObj.label}</span>
                </div>
                <ChevronDown size={16} className="text-gray-500" />
              </div>
              
              {isFilterDropdownOpen && (
                <div className="absolute top-full left-0 z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                  {filterTypes.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => {
                        setFilterType(type.id);
                        setIsFilterDropdownOpen(false);
                      }}
                    >
                      {type.icon}
                      <span>{type.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera List Toggle */}
      <div 
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors flex-shrink-0"
        onClick={() => setIsCameraListOpen(!isCameraListOpen)}
      >
        <h2 className="text-xs font-bold text-gray-555 text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <CameraIcon size={14} />
          Cameras ({filteredCameras.length})
        </h2>
        {isCameraListOpen ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
      </div>

      {isCameraListOpen && (
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-2">
          {filteredCameras.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No cameras found matching search.</div>
          ) : (
            <div className="space-y-2">
              {filteredCameras.map((camera) => {
                const isSelected = selectedCameraId === camera.id;
                return (
                  <div
                    key={camera.id}
                    onClick={() => onSelectCamera(camera)}
                    className={`rounded-lg cursor-pointer border p-3 transition-colors text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-gray-900 truncate">
                          {camera.name || camera.type.replace('_', ' ')}
                        </h3>
                        {camera.address && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{camera.address}</p>
                        )}
                        {camera.publicOutputUrl && (
                          <div className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            getLiveCameraType(camera) === 'traffic'
                              ? 'text-indigo-800 bg-indigo-100'
                              : 'text-green-800 bg-green-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                              getLiveCameraType(camera) === 'traffic' ? 'bg-indigo-500' : 'bg-green-500'
                            }`}></span>
                            {getLiveCameraType(camera) === 'traffic' ? 'Traffic Live' : 'Public Webcam'}
                          </div>
                        )}
                      </div>
                      <div className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                        camera.type === 'cctv' ? 'bg-orange-100 text-orange-850' :
                        camera.type === 'police_council' ? 'bg-blue-100 text-blue-800' :
                        camera.type === 'pfs' ? 'bg-yellow-105 bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {camera.type === 'pfs' ? 'PFS' : camera.type.replace('_', ' ')}
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="mt-4 pt-3 border-t border-gray-200 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                          <div>
                            <span className="block text-gray-400">Type</span>
                            <span className="font-semibold text-gray-800 capitalize">
                              {camera.type.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="block text-gray-400">Direction</span>
                            <span className="font-semibold text-gray-800">
                              {camera.direction !== undefined ? `${camera.direction}°` : 'Omnidirectional'}
                            </span>
                          </div>
                        </div>

                        <div className="bg-gray-100 p-2 rounded text-[10px] text-gray-600 space-y-1">
                          <p><span className="text-gray-400">Coords:</span> {camera.latitude.toFixed(5)}, {camera.longitude.toFixed(5)}</p>
                          <p><span className="text-gray-400">Added:</span> {camera.createdAt?.toDate ? camera.createdAt.toDate().toLocaleDateString() : 'N/A'}</p>
                          <p><span className="text-gray-400">Verified:</span> {camera.lastVerifiedAt?.toDate ? camera.lastVerifiedAt.toDate().toLocaleDateString() : 'Never'}</p>
                        </div>

                        {camera.publicOutputUrl && (
                          <div className={`mt-3 p-2 bg-slate-100 rounded space-y-2`}>
                            <p className="font-bold flex items-center gap-1 text-[11px] text-gray-700">
                              <Video size={12} className="text-slate-500" />
                              <span>Live Stream Output</span>
                            </p>
                            
                            {playingCameras[camera.id] ? (
                              <div className="space-y-2">
                                {/\.(jpg|jpeg|png|webp|gif)/i.test(camera.publicOutputUrl) ? (
                                  <div className="relative rounded overflow-hidden border border-gray-200 h-24 bg-black">
                                    <img 
                                      src={camera.publicOutputUrl} 
                                      alt="CCTV" 
                                      className="object-cover w-full h-full"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : camera.publicOutputUrl.includes('youtube.com') || camera.publicOutputUrl.includes('youtu.be') ? (
                                  <div className="relative rounded overflow-hidden border border-gray-200 h-28 bg-black">
                                    <iframe
                                      src={camera.publicOutputUrl.replace('watch?v=', 'embed/').split('&')[0]}
                                      title="YouTube Live Stream"
                                      className="w-full h-full border-0"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    ></iframe>
                                  </div>
                                ) : (
                                  <div className="relative rounded overflow-hidden border border-gray-200 h-32 bg-black">
                                    <iframe
                                      src={((): string => {
                                        const url = camera.publicOutputUrl || '';
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
                                        return url;
                                      })()}
                                      title="Live camera feed"
                                      className="w-full h-full border-0"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    ></iframe>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setPlayingCameras(prev => ({ ...prev, [camera.id]: false }))}
                                  className="w-full py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-bold text-[10px] transition-colors"
                                >
                                  Pause Stream
                                </button>
                              </div>
                            ) : (
                              <div className="p-2 bg-white border border-gray-200 rounded text-center">
                                <p className="text-[10px] text-gray-400 mb-1">Stream is paused to save data.</p>
                                <button
                                  type="button"
                                  onClick={() => setPlayingCameras(prev => ({ ...prev, [camera.id]: true }))}
                                  className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1"
                                >
                                  <Play size={10} fill="currentColor" />
                                  Play Stream
                                </button>
                              </div>
                            )}

                            <a 
                              href={camera.publicOutputUrl} 
                              target="_blank" 
                              rel="noreferrer noopener"
                              className="w-full py-1 bg-gray-900 hover:bg-gray-800 text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1"
                            >
                              <ExternalLink size={10} />
                              Open Live Webcam Site
                            </a>
                          </div>
                        )}

                        <div className="pt-2 border-t border-gray-200">
                          <div className="bg-blue-50 p-2 rounded">
                            <p className="text-[10px] text-blue-800 font-semibold mb-0.5">Reference & Legality</p>
                            {camera.policeReferenceNumber ? (
                              <p className="text-gray-600 font-mono text-[10px]">
                                REF: {camera.policeReferenceNumber}
                              </p>
                            ) : (
                              <p className="text-gray-400 italic text-[10px]">No reference recorded.</p>
                            )}
                            <p className="text-[9px] text-blue-500 font-medium mt-1">This is a public/retail camera. No private flat/house numbers recorded.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sidebar Utilities Footer */}
      <div className="p-4 border-t border-gray-200 bg-white mt-auto flex-shrink-0 space-y-2">
        {canAdd && (
          <button
            onClick={onAddCameraClick}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-semibold text-sm transition-colors"
          >
            <Plus size={18} />
            Add Camera
          </button>
        )}
        <button
          onClick={handleExportData}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-md text-xs transition-colors"
        >
          <Download size={14} />
          Export to CSV
        </button>
      </div>
    </div>
  );
}
