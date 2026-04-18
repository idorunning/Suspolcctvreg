import React, { useState } from 'react';
import { Camera, User } from '../types';
import { Search, Plus, MapPin, Filter, Navigation, Loader2, Camera as CameraIcon, Video, Shield, Fuel, HelpCircle, ChevronDown, ChevronRight, Download, Cctv } from 'lucide-react';

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
  
  const [locationSearch, setLocationSearch] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isPrimaryMenuOpen, setIsPrimaryMenuOpen] = useState(true);
  const [isCameraListOpen, setIsCameraListOpen] = useState(true);

  const filterTypes = [
    { id: 'all', label: 'All Types', icon: <Filter size={16} className="text-gray-500" /> },
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
      camera.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      // Use Nominatim API for geocoding (OpenStreetMap)
      // Restrict to UK
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
    
    const headers = ['ID', 'Type', 'Name', 'Address', 'Owner Name', 'Police Reference', 'Latitude', 'Longitude', 'Direction', 'Field of View', 'View Distance', 'Added By', 'Creator Email', 'Created At', 'Last Verified At'];
    
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
          `"${(c.ownerName || '').replace(/"/g, '""')}"`,
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
    <div className="w-80 h-full bg-white border-r border-gray-200 flex flex-col shadow-lg z-10 relative">
      <div className="p-4 border-b border-gray-200 bg-blue-700 text-white flex-shrink-0">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MapPin size={24} />
          Sussex Camera Registry v3.0
        </h1>
        <p className="text-sm text-blue-100 mt-1">Police Reference Tool</p>
      </div>

      {/* Primary Menu Toggle */}
      <div 
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 flex-shrink-0"
        onClick={() => setIsPrimaryMenuOpen(!isPrimaryMenuOpen)}
      >
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <Filter size={16} />
          Location & Filters
        </h2>
        {isPrimaryMenuOpen ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
      </div>

      {isPrimaryMenuOpen && (
        <div className="p-4 border-b border-gray-200 space-y-4 bg-gray-50 flex-shrink-0">
          <form onSubmit={handleLocationSearch} className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Jump to Location</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Navigation className="absolute left-2.5 top-2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Postcode, town, street..."
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                disabled={isSearchingLocation || !locationSearch.trim()}
                className="bg-white hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50"
              >
                {isSearchingLocation ? <Loader2 size={16} className="animate-spin" /> : 'Go'}
              </button>
            </div>
            {locationError && <p className="text-xs text-red-500">{locationError}</p>}
          </form>

          <div className="pt-2 border-t border-gray-200 space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase">Filter Cameras</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search ref, owner, address..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 relative">
              <div 
                className="flex-1 border border-gray-300 rounded-md py-1.5 px-2 text-sm bg-white cursor-pointer flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              >
                <div className="flex items-center gap-2">
                  {selectedFilterObj.icon}
                  <span>{selectedFilterObj.label}</span>
                </div>
                <ChevronDown size={14} className="text-gray-500" />
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
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 flex-shrink-0"
        onClick={() => setIsCameraListOpen(!isCameraListOpen)}
      >
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <CameraIcon size={16} />
          Camera List ({filteredCameras.length})
        </h2>
        {isCameraListOpen ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
      </div>

      {isCameraListOpen && (
        <div className="flex-1 overflow-y-auto p-2 bg-white">
          {filteredCameras.length === 0 ? (
            <div className="text-center p-4 text-gray-500">
              No cameras found matching your criteria.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCameras.map((camera) => (
                <div
                  key={camera.id}
                  onClick={() => onSelectCamera(camera)}
                  className={`p-3 rounded-lg cursor-pointer border transition-all ${
                    selectedCameraId === camera.id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-gray-900 capitalize">
                      {camera.name || camera.type.replace('_', ' ')}
                    </h3>
                  </div>
                  
                  {selectedCameraId === camera.id && (
                    <div className="mt-3 pt-3 border-t border-blue-200 text-xs space-y-2">
                      <p className="text-gray-600">
                        <span className="font-semibold">Type:</span> <span className="capitalize">{camera.type.replace('_', ' ')}</span>
                      </p>
                      {camera.address && (
                        <p className="text-gray-600">
                          <span className="font-semibold">Address:</span> {camera.address}
                        </p>
                      )}
                      <p className="text-gray-600">
                        <span className="font-semibold">Location:</span> {camera.latitude.toFixed(6)}, {camera.longitude.toFixed(6)}
                      </p>
                      {camera.direction !== undefined && (
                        <p className="text-gray-600">
                          <span className="font-semibold">Direction:</span> {camera.direction}°
                        </p>
                      )}
                      <p className="text-gray-600">
                        <span className="font-semibold">Date Created:</span> {camera.createdAt?.toDate ? camera.createdAt.toDate().toLocaleString() : 'Unknown'}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-semibold">Last verified:</span> {camera.lastVerifiedAt?.toDate ? camera.lastVerifiedAt.toDate().toLocaleString() : 'Never'}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-semibold">Created by:</span> {camera.creatorEmail}
                      </p>

                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="space-y-2 bg-blue-50 p-2 rounded border border-blue-100">
                          <p className="text-gray-800 font-medium mb-1">Owner Details</p>
                          {camera.ownerName && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Name:</span> {camera.ownerName}
                            </p>
                          )}
                          {camera.policeReferenceNumber && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Police Reference Number:</span> {camera.policeReferenceNumber}
                            </p>
                          )}
                          {!camera.ownerName && !camera.policeReferenceNumber && (
                            <p className="text-gray-500 italic">No additional details provided.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 border-t border-gray-200 mt-auto flex-shrink-0 bg-white space-y-2">
        {canAdd && (
          <button
            onClick={onAddCameraClick}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium transition-colors"
          >
            <Plus size={18} />
            Add New Camera
          </button>
        )}
        <button
          onClick={handleExportData}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 py-2 rounded-md font-medium transition-colors"
        >
          <Download size={18} />
          Export Data (CSV)
        </button>
      </div>
    </div>
  );
}
