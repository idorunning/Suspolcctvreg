import React, { useState } from 'react';
import { Camera, User, UserRole } from '../types';
import { Search, Plus, MapPin, Filter, Navigation, Loader2, Camera as CameraIcon, Video, Shield, Fuel, HelpCircle, ChevronDown, ChevronRight, Download, Cctv, Play, Car, CircleDot, Trash2, CheckSquare, Square } from 'lucide-react';

interface SidebarProps {
  cameras: Camera[];
  onSelectCamera: (camera: Camera) => void;
  onAddCameraClick: () => void;
  selectedCameraId?: string;
  onLocationFound?: (lat: number, lng: number) => void;
  canAdd?: boolean;
  circleFilter?: { center: [number, number]; radius: number } | null;
  onClearCircleFilter?: () => void;
  userRole?: UserRole | null;
  onBulkDelete?: (cameraIds: string[]) => Promise<void>;
}

const PoliceCameraIcon = ({ size, className }: { size: number, className?: string }) => (
  <Shield size={size} className={className} fill="currentColor" />
);

export default function Sidebar({ 
  cameras, 
  onSelectCamera, 
  onAddCameraClick, 
  selectedCameraId, 
  onLocationFound, 
  canAdd = true,
  circleFilter,
  onClearCircleFilter,
  userRole,
  onBulkDelete
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  
  const [locationSearch, setLocationSearch] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isPrimaryMenuOpen, setIsPrimaryMenuOpen] = useState(true);
  const [isCameraListOpen, setIsCameraListOpen] = useState(true);

  // States for bulk deletion
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const filterTypes = [
    { id: 'all', label: 'All Types', icon: <Filter size={16} className="text-gray-500" /> },
    { id: 'cctv', label: 'Retail CCTV', icon: <Cctv size={16} className="text-orange-500" /> },
    { id: 'police_council', label: 'Police/Council', icon: <PoliceCameraIcon size={16} className="text-blue-600" /> },
    { id: 'pfs', label: 'Petrol Filling Station (PFS)', icon: <Fuel size={16} className="text-orange-600" /> },
    { id: 'other', label: 'Other', icon: <HelpCircle size={16} className="text-gray-600" /> },
  ];

  const handleSelectAll = () => {
    const visibleIds = filteredCameras.map(c => c.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handlePerformBulkDelete = async () => {
    if (selectedIds.length === 0 || !onBulkDelete) return;
    if (!window.confirm(`Are you sure you want to delete these ${selectedIds.length} cameras? They will be removed fully from the active registry and safely held in the archive for 30 days.`)) return;
    
    setIsDeleting(true);
    try {
      await onBulkDelete(selectedIds);
      setSelectedIds([]);
      setIsBulkMode(false);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      alert("Failed to delete cameras. Insufficient permissions.");
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedFilterObj = filterTypes.find(t => t.id === filterType) || filterTypes[0];

  const filteredCameras = cameras.filter(camera => {
    const matchesSearch = 
      camera.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      camera.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      camera.policeReferenceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesType = filterType === 'all' || camera.type === filterType;
    
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

      {circleFilter && (
        <div className="mx-4 mt-3 p-2.5 bg-blue-55 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1 flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between text-blue-800 font-bold">
            <span className="flex items-center gap-1">
              <CircleDot size={12} className="text-blue-600 animate-pulse" />
              Circle Area Filter
            </span>
            <button
              onClick={onClearCircleFilter}
              className="text-[10px] text-blue-600 hover:text-blue-800 underline cursor-pointer font-bold"
              style={{ background: 'none', border: 'none', padding: 0 }}
              type="button"
            >
              Clear
            </button>
          </div>
          <p className="text-gray-600 leading-relaxed font-medium">
            Listing only the <span className="text-blue-700 font-bold">{cameras.length}</span> cameras within <span className="font-bold text-blue-900">{circleFilter.radius}m</span> of drawn area.
          </p>
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

      {isCameraListOpen && (userRole === 'admin' || userRole === 'user') && (
        <div className="bg-slate-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between text-xs flex-shrink-0 font-semibold text-slate-600">
          {!isBulkMode ? (
            <>
              <span className="text-gray-500">Registry Operations:</span>
              <button
                onClick={() => {
                  setIsBulkMode(true);
                  setSelectedIds([]);
                }}
                className="text-red-650 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                type="button"
              >
                <Trash2 size={13} />
                Bulk Delete
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  type="button"
                >
                  {filteredCameras.map(c => c.id).every(id => selectedIds.includes(id)) ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-gray-400 font-normal">|</span>
                <span className="text-gray-700 font-bold">{selectedIds.length} Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePerformBulkDelete}
                  disabled={selectedIds.length === 0 || isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1 cursor-pointer shadow-sm text-[10px]"
                  type="button"
                >
                  {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Delete ({selectedIds.length})
                </button>
                <button
                  onClick={() => {
                    setIsBulkMode(false);
                    setSelectedIds([]);
                  }}
                  className="text-gray-500 hover:text-gray-700 font-bold cursor-pointer"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isCameraListOpen && (
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-2">
          {filteredCameras.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No cameras found matching search.</div>
          ) : (
            <div className="space-y-2">
              {filteredCameras.map((camera) => {
                const isSelected = selectedCameraId === camera.id;
                const isSelectedForBulk = selectedIds.includes(camera.id);
                
                const handleCardClick = () => {
                  if (isBulkMode) {
                    if (isSelectedForBulk) {
                      setSelectedIds(prev => prev.filter(id => id !== camera.id));
                    } else {
                      setSelectedIds(prev => [...prev, camera.id]);
                    }
                  } else {
                    onSelectCamera(camera);
                  }
                };

                return (
                  <div
                    key={camera.id}
                    onClick={handleCardClick}
                    className={`rounded-lg cursor-pointer border p-3 transition-colors text-left ${
                      isBulkMode
                        ? (isSelectedForBulk ? 'border-red-500 bg-red-50/50' : 'border-gray-200 bg-white hover:bg-gray-50')
                        : (isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50')
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isBulkMode && (
                        <div className="flex-shrink-0 mt-1">
                          {isSelectedForBulk ? (
                            <CheckSquare className="text-red-650" size={17} />
                          ) : (
                            <Square className="text-gray-400" size={17} />
                          )}
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-gray-900 truncate">
                              {camera.name || camera.type.replace('_', ' ')}
                            </h3>
                            {camera.address && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{camera.address}</p>
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
                        
                        {isSelected && !isBulkMode && (
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
                    </div>
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
