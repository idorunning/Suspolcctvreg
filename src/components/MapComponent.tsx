import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera } from '../types';
import { 
  Camera as CameraIcon, Video, Shield, HelpCircle, Move, Fuel, ArrowLeftRight, Cctv, Edit2,
  Layers, Map as MapIcon, Globe, CircleDot, X, Download, Sliders, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { calculateBearing, calculateDestination, calculateDistance } from '../utils/geo';
import CoverageGapsLayer from './CoverageGapsLayer';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DraftCamera {
  lat: number;
  lng: number;
  direction?: number;
  fieldOfView?: number;
  viewDistance?: number;
  type: string;
}

interface MapComponentProps {
  cameras: Camera[];
  selectedCamera: Camera | null;
  onSelectCamera: (camera: Camera) => void;
  onMapClick?: (lat: number, lng: number) => void;
  isAddingCamera?: boolean;
  mapCenter?: [number, number] | null;
  draftCamera?: DraftCamera | null;
  onDraftDirectionChange?: (direction: number, distance?: number, fov?: number) => void;
  showHeatmap?: boolean;
  onEditCamera?: (camera: Camera) => void;
  canEditCamera?: (camera: Camera) => boolean;
  focusTrigger?: number;
  // Circle Filter props
  circleFilter?: { center: [number, number]; radius: number } | null;
  onCircleFilterChange?: (filter: { center: [number, number]; radius: number } | null) => void;
  isDrawingCircle?: boolean;
  setIsDrawingCircle?: (val: boolean) => void;
}

const MapEvents = ({ 
  onMapClick, 
  isAddingCamera, 
  isDrawingCircle 
}: { 
  onMapClick?: (lat: number, lng: number) => void, 
  isAddingCamera?: boolean,
  isDrawingCircle?: boolean
}) => {
  const map = useMap();
  
  useEffect(() => {
    if (isAddingCamera || isDrawingCircle) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [isAddingCamera, isDrawingCircle, map]);

  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      if ((isAddingCamera || isDrawingCircle) && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, isAddingCamera, isDrawingCircle, onMapClick]);

  return null;
};

const MapFocus = ({ selectedCamera, mapCenter, draftCamera, isAddingCamera, focusTrigger }: { selectedCamera: Camera | null, mapCenter?: [number, number] | null, draftCamera?: DraftCamera | null, isAddingCamera: boolean, focusTrigger?: number }) => {
  const map = useMap();
  const draftLat = draftCamera?.lat;
  const draftLng = draftCamera?.lng;
  
  useEffect(() => {
    // Invalidate size to prevent map disappearing glitches when UI overlays change
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    if (draftLat !== undefined && draftLng !== undefined) {
      map.flyTo([draftLat, draftLng], 19);
    } else if (selectedCamera) {
      map.flyTo([selectedCamera.latitude, selectedCamera.longitude], 18);
    } else if (mapCenter) {
      map.flyTo(mapCenter, 15);
    }
  }, [selectedCamera, mapCenter, draftLat, draftLng, map, isAddingCamera, focusTrigger]);
  return null;
};

const getIconForType = (type: string, size = 24) => {
  switch (type) {
    case 'cctv': 
      return <Cctv size={size} color="#ffffff" strokeWidth={2.5} />;
    case 'police_council': 
      return <Shield size={size} color="#ffffff" fill="#ffffff" strokeWidth={1} />;
    case 'pfs': 
      return <Fuel size={size} color="#ffffff" strokeWidth={2.5} />;
    default: 
      return <HelpCircle size={size} color="#ffffff" strokeWidth={2.5} />;
  }
};

const getBgColorForType = (type: string) => {
  switch (type) {
    case 'cctv': return 'bg-orange-500';
    case 'police_council': return 'bg-blue-600';
    case 'pfs': return 'bg-red-600';
    default: return 'bg-slate-500';
  }
};

const ZoomTracker = ({ onZoomChange }: { onZoomChange: (z: number) => void }) => {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    map.on('zoom', handleZoom);
    map.on('zoomend', handleZoom);
    // Trigger initial set
    onZoomChange(map.getZoom());
    return () => {
      map.off('zoom', handleZoom);
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);
  return null;
};

const createCustomIcon = (type: string, direction?: number, isDraft = false, zoom = 12, isSelected = false) => {
  const bgColor = getBgColorForType(type);
  
  // Dynamic scaling based on zoom
  let size = 22;
  let showInnerIcon = true;
  let innerIconSize = 12;
  let borderWidth = 2;
  
  if (zoom <= 10) {
    size = 7;
    showInnerIcon = false;
    borderWidth = 1;
  } else if (zoom === 11) {
    size = 9;
    showInnerIcon = false;
    borderWidth = 1;
  } else if (zoom === 12) {
    size = 12;
    showInnerIcon = false;
    borderWidth = 1.25;
  } else if (zoom === 13) {
    size = 16;
    showInnerIcon = true;
    innerIconSize = 9;
    borderWidth = 1.5;
  } else if (zoom === 14) {
    size = 20;
    showInnerIcon = true;
    innerIconSize = 11;
    borderWidth = 1.5;
  } else if (zoom === 15) {
    size = 24;
    showInnerIcon = true;
    innerIconSize = 13;
    borderWidth = 2;
  } else { // zoom >= 16
    size = 28;
    showInnerIcon = true;
    innerIconSize = 15;
    borderWidth = 2;
  }

  // Arrow proportions rotating exactly around center of icon
  const arrowHeight = Math.max(4, Math.round(size * 0.3));
  const arrowWidth = Math.max(3, Math.round(size * 0.18));
  const topOffset = -(arrowHeight + 1);
  const originY = (size / 2) + Math.abs(topOffset);

  let borderClass = 'border-white';
  if (isDraft) {
    borderClass = 'border-amber-400 animate-pulse';
  } else if (isSelected) {
    borderClass = 'marker-selected-pulse';
  }

  const iconHtml = renderToString(
    <div 
      className={`relative flex items-center justify-center ${bgColor} rounded-full ${borderClass}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderWidth: `${borderWidth}px`,
        borderStyle: 'solid',
        boxShadow: size > 9 
          ? '0 0 0 1px rgba(0,0,0,0.4), 0 3px 6px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.4)' 
          : '0 1px 2px rgba(0,0,0,0.4)',
        transition: 'width 0.15s ease, height 0.15s ease'
      }}
    >
      {showInnerIcon && getIconForType(type, innerIconSize)}
      {direction !== undefined && !isNaN(direction) && size > 9 && (
        <div 
          className="absolute w-0 h-0"
          style={{
            left: '50%',
            top: `${topOffset}px`,
            marginLeft: `-${arrowWidth}px`,
            borderLeft: `${arrowWidth}px solid transparent`,
            borderRight: `${arrowWidth}px solid transparent`,
            borderBottom: `${arrowHeight}px solid #ef4444`,
            transform: `rotate(${direction}deg)`,
            transformOrigin: `${arrowWidth}px ${originY}px`,
            filter: 'drop-shadow(0px 1px 1.5px rgba(0,0,0,0.45))'
          }}
        />
      )}
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-camera-icon bg-transparent border-none',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

const handleIcon = L.divIcon({
  html: renderToString(
    <div className="flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full shadow-lg border-2 border-white cursor-move">
      <Move size={14} />
    </div>
  ),
  className: 'direction-handle-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const fovHandleIcon = L.divIcon({
  html: renderToString(
    <div className="flex items-center justify-center w-5 h-5 bg-blue-500 text-white rounded-full shadow-lg border-2 border-white cursor-ew-resize">
      <ArrowLeftRight size={10} />
    </div>
  ),
  className: 'fov-handle-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const DraggableHandle = ({ position, icon, onDrag }: { position: [number, number], icon: L.DivIcon, onDrag: (lat: number, lng: number) => void }) => {
  const markerRef = React.useRef<L.Marker>(null);
  const isDragging = React.useRef(false);

  useEffect(() => {
    if (markerRef.current && !isDragging.current) {
      markerRef.current.setLatLng(position);
    }
  }, [position[0], position[1]]);

  return (
    <Marker
      position={position}
      icon={icon}
      draggable={true}
      ref={markerRef}
      eventHandlers={{
        dragstart: () => { isDragging.current = true; },
        dragend: () => { isDragging.current = false; },
        drag: (e) => {
          const pos = e.target.getLatLng();
          onDrag(pos.lat, pos.lng);
        }
      }}
    />
  );
};

const calculateFovPolygon = (lat: number, lng: number, direction: number, fov: number, distanceMeters = 30) => {
  const earthRadius = 6378137;
  const points: [number, number][] = [[lat, lng]];
  
  const halfFov = fov / 2;
  const startAngle = direction - halfFov;
  const endAngle = direction + halfFov;
  
  for (let angle = startAngle; angle <= endAngle; angle += 5) {
    const angleRad = (angle * Math.PI) / 180;
    const dLat = (distanceMeters * Math.cos(angleRad)) / earthRadius;
    const dLng = (distanceMeters * Math.sin(angleRad)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
    
    points.push([
      lat + (dLat * 180) / Math.PI,
      lng + (dLng * 180) / Math.PI
    ]);
  }
  
  return points;
};

export default function MapComponent({ 
  cameras, 
  selectedCamera, 
  onSelectCamera, 
  onMapClick, 
  isAddingCamera, 
  mapCenter, 
  draftCamera, 
  onDraftDirectionChange, 
  showHeatmap, 
  onEditCamera, 
  canEditCamera, 
  focusTrigger,
  circleFilter,
  onCircleFilterChange,
  isDrawingCircle,
  setIsDrawingCircle
}: MapComponentProps) {
  const defaultCenter: [number, number] = [50.936, -0.141]; 
  
  const [mapLayer, setMapLayer] = useState<'road' | 'satellite' | 'plain' | 'humanitarian'>('road');
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [mapZoom, setMapZoom] = useState(12);

  const [mapFilters, setMapFilters] = useState({
    cctv: true,
    police_council: true,
    pfs: true,
    other: true
  });

  const toggleMapFilter = (key: keyof typeof mapFilters) => {
    setMapFilters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const mapFilteredCameras = useMemo(() => {
    return cameras.filter(camera => {
      // Avoid showing the duplicate non-draft icon of the camera currently being edited
      if (draftCamera && selectedCamera && camera.id === selectedCamera.id) {
        return false;
      }
      // Check standard camera type is enabled
      const typeKey = camera.type === 'police_council' ? 'police_council' : (camera.type as keyof typeof mapFilters);
      if (!mapFilters[typeKey]) {
        return false;
      }
      return true;
    });
  }, [cameras, mapFilters, draftCamera, selectedCamera]);

  const handleExportCircleCSV = () => {
    if (mapFilteredCameras.length === 0) return;
    
    const headers = ['ID', 'Type', 'Name', 'Address', 'Police Reference', 'Latitude', 'Longitude', 'Direction', 'Field of View', 'View Distance', 'Creator Email', 'Created At', 'Last Verified At'];
    
    const csvRows = [
      headers.join(','),
      ...mapFilteredCameras.map(c => {
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
          `"${(c.creatorEmail || '').replace(/"/g, '""')}"`,
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
    link.setAttribute('download', `circle_cameras_${circleFilter?.radius || 0}m_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate handle position for draft camera
  const handlePos = useMemo(() => {
    if (!draftCamera || draftCamera.direction === undefined || isNaN(draftCamera.direction)) return null;
    const dist = draftCamera.viewDistance || 25;
    return calculateDestination(draftCamera.lat, draftCamera.lng, draftCamera.direction, dist);
  }, [draftCamera?.lat, draftCamera?.lng, draftCamera?.direction, draftCamera?.viewDistance]);

  const leftFovPos = useMemo(() => {
    if (!draftCamera || draftCamera.direction === undefined || draftCamera.fieldOfView === undefined) return null;
    const dist = draftCamera.viewDistance || 25;
    return calculateDestination(draftCamera.lat, draftCamera.lng, draftCamera.direction - draftCamera.fieldOfView / 2, dist);
  }, [draftCamera?.lat, draftCamera?.lng, draftCamera?.direction, draftCamera?.fieldOfView, draftCamera?.viewDistance]);

  const rightFovPos = useMemo(() => {
    if (!draftCamera || draftCamera.direction === undefined || draftCamera.fieldOfView === undefined) return null;
    const dist = draftCamera.viewDistance || 25;
    return calculateDestination(draftCamera.lat, draftCamera.lng, draftCamera.direction + draftCamera.fieldOfView / 2, dist);
  }, [draftCamera?.lat, draftCamera?.lng, draftCamera?.direction, draftCamera?.fieldOfView, draftCamera?.viewDistance]);

  const handleFovDrag = (lat: number, lng: number) => {
    if (!draftCamera || draftCamera.direction === undefined) return;
    const newBearing = calculateBearing(draftCamera.lat, draftCamera.lng, lat, lng);
    let diff = newBearing - draftCamera.direction;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    
    const newFov = Math.abs(diff) * 2;
    const clampedFov = Math.max(10, Math.min(360, newFov));
    
    if (onDraftDirectionChange) {
      onDraftDirectionChange(draftCamera.direction, draftCamera.viewDistance, Math.round(clampedFov));
    }
  };

  return (
    <div className="w-full h-full relative">
      <MapContainer center={defaultCenter} zoom={10} className="w-full h-full z-0">
        {mapLayer === 'road' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {mapLayer === 'satellite' && (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        {mapLayer === 'plain' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        )}
        {mapLayer === 'humanitarian' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://hotosm.org/">Humanitarian OpenStreetMap Team</a>'
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          />
        )}
        <MapEvents onMapClick={onMapClick} isAddingCamera={isAddingCamera} isDrawingCircle={isDrawingCircle} />
        <ZoomTracker onZoomChange={setMapZoom} />
        <MapFocus selectedCamera={selectedCamera} mapCenter={mapCenter} draftCamera={draftCamera} isAddingCamera={!!isAddingCamera} focusTrigger={focusTrigger} />
        
        {circleFilter && (
          <Circle
            center={circleFilter.center}
            radius={circleFilter.radius}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '4'
            }}
          />
        )}
        
        {/* Render existing cameras */}
        {mapFilteredCameras.map((camera) => {
          const isSelected = selectedCamera?.id === camera.id;
          return (
            <React.Fragment key={`${camera.id}-${mapZoom}-${isSelected}`}>
              <Marker 
                position={[camera.latitude, camera.longitude]}
                icon={createCustomIcon(camera.type, camera.direction, false, mapZoom, isSelected)}
                eventHandlers={{
                  click: () => onSelectCamera(camera)
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[150px]">
                    <h3 className="font-bold text-lg capitalize">{camera.name || `${camera.type.replace('_', ' ')} Camera`}</h3>
                    {camera.address && <p className="text-sm text-gray-600">{camera.address}</p>}
                    {camera.policeReferenceNumber && <p className="text-sm mt-1">Ref: {camera.policeReferenceNumber}</p>}

                    {onEditCamera && canEditCamera && canEditCamera(camera) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCamera(camera);
                        }}
                        className="mt-2 w-full flex items-center justify-center gap-1 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-200 hover:bg-blue-200 transition-colors"
                      >
                        <Edit2 size={12} />
                        Amend Camera
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
              
              {camera.direction !== undefined && !isNaN(camera.direction) && camera.fieldOfView !== undefined && camera.fieldOfView > 0 && (
                <Polygon 
                  key={`polygon-${camera.id}-${camera.direction}-${camera.fieldOfView}-${camera.viewDistance}`}
                  positions={calculateFovPolygon(camera.latitude, camera.longitude, camera.direction, camera.fieldOfView, camera.viewDistance || 30)}
                  pathOptions={{ 
                    color: isSelected ? '#ef4444' : '#3b82f6', 
                    fillColor: isSelected ? '#ef4444' : '#3b82f6', 
                    fillOpacity: isSelected ? 0.4 : 0.2,
                    weight: isSelected ? 2 : 1,
                    className: isSelected ? 'cone-glow-selected' : 'cone-glow-default'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Render draft camera for adding/editing */}
        {draftCamera && (
          <React.Fragment>
            <Marker 
              key={`draft-marker-${draftCamera.lat}-${draftCamera.lng}-${mapZoom}`}
              position={[draftCamera.lat, draftCamera.lng]}
              icon={createCustomIcon(draftCamera.type, draftCamera.direction, true, mapZoom)}
            />
            {draftCamera.direction !== undefined && !isNaN(draftCamera.direction) && draftCamera.fieldOfView !== undefined && draftCamera.fieldOfView > 0 && (
              <Polygon 
                key={`draft-polygon-${draftCamera.lat}-${draftCamera.lng}-${draftCamera.direction}-${draftCamera.fieldOfView}-${draftCamera.viewDistance}`}
                positions={calculateFovPolygon(draftCamera.lat, draftCamera.lng, draftCamera.direction, draftCamera.fieldOfView, draftCamera.viewDistance || 30)}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.4, weight: 2, dashArray: '4', className: 'cone-glow-draft' }}
              />
            )}
            {handlePos && onDraftDirectionChange && (
              <DraggableHandle
                position={handlePos}
                icon={handleIcon}
                onDrag={(lat, lng) => {
                  const newBearing = calculateBearing(draftCamera.lat, draftCamera.lng, lat, lng);
                  const newDistance = calculateDistance(draftCamera.lat, draftCamera.lng, lat, lng);
                  onDraftDirectionChange(Math.round(newBearing), Math.round(newDistance));
                }}
              />
            )}
            {leftFovPos && onDraftDirectionChange && (
              <DraggableHandle
                position={leftFovPos}
                icon={fovHandleIcon}
                onDrag={handleFovDrag}
              />
            )}
            {rightFovPos && onDraftDirectionChange && (
              <DraggableHandle
                position={rightFovPos}
                icon={fovHandleIcon}
                onDrag={handleFovDrag}
              />
            )}
          </React.Fragment>
        )}
      </MapContainer>
      
      {isAddingCamera && !draftCamera && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-[1000] font-medium pointer-events-none">
          Click on the map to place the camera
        </div>
      )}
      {draftCamera && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white px-4 py-2 rounded-full shadow-lg z-[1000] font-medium pointer-events-none">
          Drag the red handle to aim the camera
        </div>
      )}

      {/* Recrafted Floating Overlays: Map style switcher + Circle filtering */}
      <div className="absolute top-4 right-4 z-[1001] flex flex-col gap-2.5 max-w-xs w-72 pointer-events-auto select-none sm:top-6 sm:right-6">
        <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-700/70 shadow-2xl flex flex-col gap-3 text-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              <Layers size={14} className="text-blue-400" />
              Map Controller
            </h3>
            <button
              onClick={() => setIsControlsExpanded(!isControlsExpanded)}
              className="p-1 text-slate-400 hover:text-slate-150 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={isControlsExpanded ? "Collapse Controls" : "Expand Controls"}
              type="button"
            >
              {isControlsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isControlsExpanded && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              {/* Map base layer selector */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Base Map Type</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setMapLayer('road')}
                    className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      mapLayer === 'road'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/85 hover:bg-slate-800 text-slate-305 border-slate-700/60'
                    }`}
                    type="button"
                  >
                    <MapIcon size={11} className={mapLayer === 'road' ? 'text-white' : 'text-slate-400'} />
                    Road map
                  </button>
                  <button
                    onClick={() => setMapLayer('satellite')}
                    className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      mapLayer === 'satellite'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/85 hover:bg-slate-800 text-slate-305 border-slate-700/60'
                    }`}
                    type="button"
                  >
                    <Globe size={11} className={mapLayer === 'satellite' ? 'text-white' : 'text-slate-400'} />
                    Satellite
                  </button>
                  <button
                    onClick={() => setMapLayer('plain')}
                    className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      mapLayer === 'plain'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/85 hover:bg-slate-800 text-slate-305 border-slate-700/60'
                    }`}
                    type="button"
                  >
                    <CircleDot size={11} className={mapLayer === 'plain' ? 'text-white' : 'text-slate-400'} />
                    Plain slate
                  </button>
                  <button
                    onClick={() => setMapLayer('humanitarian')}
                    className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      mapLayer === 'humanitarian'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/85 hover:bg-slate-800 text-slate-305 border-slate-700/60'
                    }`}
                    type="button"
                  >
                    <Sliders size={11} className={mapLayer === 'humanitarian' ? 'text-white' : 'text-slate-400'} />
                    Road focus
                  </button>
                </div>
              </div>

              {/* Visible Camera Types (Map Only) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Visible Camera Types</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => toggleMapFilter('cctv')}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      mapFilters.cctv
                        ? 'bg-orange-950/40 text-orange-400 border-orange-500/30'
                        : 'bg-slate-800/30 text-slate-500 border-slate-800 line-through opacity-40 hover:opacity-90'
                    }`}
                    type="button"
                  >
                    <Cctv size={11} className={mapFilters.cctv ? 'text-orange-450' : 'text-slate-600'} />
                    CCTV
                  </button>
                  <button
                    onClick={() => toggleMapFilter('police_council')}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      mapFilters.police_council
                        ? 'bg-blue-995/43 text-blue-400 border-blue-500/30'
                        : 'bg-slate-800/30 text-slate-500 border-slate-800 line-through opacity-40 hover:opacity-90'
                    }`}
                    type="button"
                  >
                    <Shield size={11} fill={mapFilters.police_council ? "currentColor" : "none"} className={mapFilters.police_council ? 'text-blue-450' : 'text-slate-600'} />
                    Police
                  </button>
                  <button
                    onClick={() => toggleMapFilter('pfs')}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      mapFilters.pfs
                        ? 'bg-rose-950/40 text-red-400 border-red-500/30'
                        : 'bg-slate-800/30 text-slate-500 border-slate-800 line-through opacity-40 hover:opacity-90'
                    }`}
                    type="button"
                  >
                    <Fuel size={11} className={mapFilters.pfs ? 'text-rose-450' : 'text-slate-600'} />
                    PFS
                  </button>
                  <button
                    onClick={() => toggleMapFilter('other')}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      mapFilters.other
                        ? 'bg-slate-800 text-slate-300 border-slate-700/60'
                        : 'bg-slate-800/30 text-slate-500 border-slate-800 line-through opacity-40 hover:opacity-90'
                    }`}
                    type="button"
                  >
                    <HelpCircle size={11} className={mapFilters.other ? 'text-slate-350' : 'text-slate-600'} />
                    Other
                  </button>
                </div>
              </div>

              {/* Circle filter area */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Map area search</span>
                
                {circleFilter ? (
                  <div className="bg-slate-800/40 rounded-xl p-2.5 border border-slate-800 space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[8px] font-bold text-slate-450 uppercase tracking-wider block">Boundary Range</span>
                        <p className="text-[11px] font-bold text-slate-200 mt-0.5">
                          {circleFilter.radius >= 1000 ? `${(circleFilter.radius / 1000).toFixed(1)} km` : `${circleFilter.radius}m`} radius
                        </p>
                      </div>
                      <span className="bg-blue-900/40 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full select-none">
                        {mapFilteredCameras.length} {mapFilteredCameras.length === 1 ? 'camera' : 'cameras'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] text-slate-450 font-bold tracking-wider uppercase">
                        <span>100m</span>
                        <span>Drag range slider</span>
                        <span>5km</span>
                      </div>
                      <input 
                        type="range" 
                        min="100" 
                        max="5000" 
                        step="50" 
                        value={circleFilter.radius} 
                        onChange={(e) => {
                          if (onCircleFilterChange) {
                            onCircleFilterChange({
                              ...circleFilter,
                              radius: parseInt(e.target.value)
                            });
                          }
                        }}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-1"
                      />
                    </div>

                    <div className="flex gap-1.5 pt-0.5">
                      <button
                        onClick={handleExportCircleCSV}
                        disabled={mapFilteredCameras.length === 0}
                        className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white font-bold py-1.5 px-2 rounded-lg text-[10px] transition-colors cursor-pointer text-center border-none"
                        title="Export details of cameras inside circle to spreadsheet file"
                        type="button"
                      >
                        <Download size={11} />
                        Export details
                      </button>
                      <button
                        onClick={() => {
                          if (onCircleFilterChange) onCircleFilterChange(null);
                        }}
                        className="p-1 px-2 border border-slate-700 hover:bg-slate-800 hover:text-red-400 rounded-lg text-slate-350 text-[10px] transition-colors cursor-pointer font-bold"
                        title="Clear area filter"
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        if (setIsDrawingCircle) {
                          setIsDrawingCircle(!isDrawingCircle);
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-1.5 font-bold py-2 px-3 rounded-lg text-xs transition-all tracking-wide cursor-pointer select-none ${
                        isDrawingCircle
                          ? 'bg-amber-950/50 text-amber-400 border border-amber-550 animate-pulse'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md border-none'
                      }`}
                      type="button"
                    >
                      <CircleDot size={13} fill={isDrawingCircle ? "currentColor" : "none"} />
                      {isDrawingCircle ? 'Click on map...' : 'Filter Area by Circle'}
                    </button>
                    {!isDrawingCircle && (
                      <p className="text-[9px] text-slate-450 italic text-center leading-normal">
                        Click to draw a circle over the map and filter cameras instantly.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

