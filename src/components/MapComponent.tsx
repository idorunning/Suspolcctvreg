import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera } from '../types';
import {
  Camera as CameraIcon,
  Shield,
  HelpCircle,
  Move,
  Fuel,
  ArrowLeftRight,
  Cctv,
  Edit2,
} from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { calculateBearing, calculateDestination, calculateDistance } from '../utils/geo';
import HeatmapLayer from './HeatmapLayer';
import { config } from '../config';

// Fix Leaflet default icon issue by pointing at locally-hosted assets.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${config.leafletAssetsPath}/marker-icon-2x.png`,
  iconUrl: `${config.leafletAssetsPath}/marker-icon.png`,
  shadowUrl: `${config.leafletAssetsPath}/marker-shadow.png`,
});

interface DraftCamera {
  lat: number;
  lng: number;
  direction?: number;
  fieldOfView?: number | null;
  viewDistance?: number | null;
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
}

const MapEvents = ({
  onMapClick,
  isAddingCamera,
}: {
  onMapClick?: (lat: number, lng: number) => void;
  isAddingCamera?: boolean;
}) => {
  const map = useMap();

  useEffect(() => {
    if (isAddingCamera) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [isAddingCamera, map]);

  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      if (isAddingCamera && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, isAddingCamera, onMapClick]);

  return null;
};

const MapFocus = ({
  selectedCamera,
  mapCenter,
  draftCamera,
  isAddingCamera,
  focusTrigger,
}: {
  selectedCamera: Camera | null;
  mapCenter?: [number, number] | null;
  draftCamera?: DraftCamera | null;
  isAddingCamera: boolean;
  focusTrigger?: number;
}) => {
  const map = useMap();
  const draftLat = draftCamera?.lat;
  const draftLng = draftCamera?.lng;

  useEffect(() => {
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

const PoliceCameraIcon = ({ size, color }: { size: number; color: string }) => (
  <div
    className="relative flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <CameraIcon size={size} color={color} />
    <Shield
      size={size * 0.5}
      color="#1e3a8a"
      fill="#3b82f6"
      className="absolute -bottom-1 -right-1"
    />
  </div>
);

const getIconForType = (type: string) => {
  switch (type) {
    case 'cctv':
      return <Cctv size={24} color="#ffffff" />;
    case 'police_council':
      return <PoliceCameraIcon size={24} color="#ffffff" />;
    case 'pfs':
      return <Fuel size={24} color="#ffffff" />;
    default:
      return <HelpCircle size={24} color="#ffffff" />;
  }
};

const getBgColorForType = (type: string) => {
  switch (type) {
    case 'cctv':
      return 'bg-orange-500';
    case 'police_council':
      return 'bg-blue-500';
    case 'pfs':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const createCustomIcon = (type: string, direction?: number | null, isDraft = false) => {
  const bgColor = getBgColorForType(type);
  const iconHtml = renderToString(
    <div
      className={`relative flex items-center justify-center w-12 h-12 ${bgColor} rounded-full border-[3px] ${
        isDraft ? 'border-amber-400 animate-pulse' : 'border-white'
      }`}
      style={{
        boxShadow:
          '0 0 0 2px rgba(0,0,0,0.4), 0 6px 16px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.6)',
      }}
    >
      {getIconForType(type)}
      {direction !== undefined && direction !== null && (
        <div
          className="absolute w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[18px] border-b-red-500"
          style={{
            top: '-20px',
            transform: `rotate(${direction}deg)`,
            transformOrigin: '50% 42px',
            filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.6))',
          }}
        />
      )}
    </div>,
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-camera-icon bg-transparent border-none',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
};

const handleIcon = L.divIcon({
  html: renderToString(
    <div className="flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full shadow-lg border-2 border-white cursor-move">
      <Move size={14} />
    </div>,
  ),
  className: 'direction-handle-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const fovHandleIcon = L.divIcon({
  html: renderToString(
    <div className="flex items-center justify-center w-5 h-5 bg-blue-500 text-white rounded-full shadow-lg border-2 border-white cursor-ew-resize">
      <ArrowLeftRight size={10} />
    </div>,
  ),
  className: 'fov-handle-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const DraggableHandle = ({
  position,
  icon,
  onDrag,
}: {
  position: [number, number];
  icon: L.DivIcon;
  onDrag: (lat: number, lng: number) => void;
}) => {
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
        dragstart: () => {
          isDragging.current = true;
        },
        dragend: () => {
          isDragging.current = false;
        },
        drag: (e) => {
          const pos = (e.target as L.Marker).getLatLng();
          onDrag(pos.lat, pos.lng);
        },
      }}
    />
  );
};

const calculateFovPolygon = (
  lat: number,
  lng: number,
  direction: number,
  fov: number,
  distanceMeters = 30,
) => {
  const earthRadius = 6378137;
  const points: [number, number][] = [[lat, lng]];

  const halfFov = fov / 2;
  const startAngle = direction - halfFov;
  const endAngle = direction + halfFov;

  for (let angle = startAngle; angle <= endAngle; angle += 5) {
    const angleRad = (angle * Math.PI) / 180;
    const dLat = (distanceMeters * Math.cos(angleRad)) / earthRadius;
    const dLng =
      (distanceMeters * Math.sin(angleRad)) /
      (earthRadius * Math.cos((lat * Math.PI) / 180));

    points.push([
      lat + (dLat * 180) / Math.PI,
      lng + (dLng * 180) / Math.PI,
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
}: MapComponentProps) {
  const defaultCenter: [number, number] = [50.936, -0.141];

  const handlePos = useMemo(() => {
    if (
      !draftCamera ||
      draftCamera.direction === undefined ||
      draftCamera.direction === null ||
      Number.isNaN(draftCamera.direction)
    )
      return null;
    const dist = draftCamera.viewDistance || 25;
    return calculateDestination(
      draftCamera.lat,
      draftCamera.lng,
      draftCamera.direction,
      dist,
    );
  }, [
    draftCamera?.lat,
    draftCamera?.lng,
    draftCamera?.direction,
    draftCamera?.viewDistance,
  ]);

  const leftFovPos = useMemo(() => {
    if (
      !draftCamera ||
      draftCamera.direction === undefined ||
      draftCamera.direction === null ||
      draftCamera.fieldOfView === undefined ||
      draftCamera.fieldOfView === null
    )
      return null;
    const dist = draftCamera.viewDistance || 25;
    return calculateDestination(
      draftCamera.lat,
      draftCamera.lng,
      draftCamera.direction - draftCamera.fieldOfView / 2,
      dist,
    );
  }, [
    draftCamera?.lat,
    draftCamera?.lng,
    draftCamera?.direction,
    draftCamera?.fieldOfView,
    draftCamera?.viewDistance,
  ]);

  const rightFovPos = useMemo(() => {
    if (
      !draftCamera ||
      draftCamera.direction === undefined ||
      draftCamera.direction === null ||
      draftCamera.fieldOfView === undefined ||
      draftCamera.fieldOfView === null
    )
      return null;
    const dist = draftCamera.viewDistance || 25;
    return calculateDestination(
      draftCamera.lat,
      draftCamera.lng,
      draftCamera.direction + draftCamera.fieldOfView / 2,
      dist,
    );
  }, [
    draftCamera?.lat,
    draftCamera?.lng,
    draftCamera?.direction,
    draftCamera?.fieldOfView,
    draftCamera?.viewDistance,
  ]);

  const handleFovDrag = (lat: number, lng: number) => {
    if (
      !draftCamera ||
      draftCamera.direction === undefined ||
      draftCamera.direction === null
    )
      return;
    const newBearing = calculateBearing(draftCamera.lat, draftCamera.lng, lat, lng);
    let diff = newBearing - draftCamera.direction;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    const newFov = Math.abs(diff) * 2;
    if (Number.isNaN(newFov)) return;
    const clampedFov = Math.max(10, Math.min(360, newFov));

    if (onDraftDirectionChange) {
      onDraftDirectionChange(
        draftCamera.direction,
        draftCamera.viewDistance ?? undefined,
        Math.round(clampedFov),
      );
    }
  };

  return (
    <div className="w-full h-full relative">
      <MapContainer center={defaultCenter} zoom={10} className="w-full h-full z-0">
        <TileLayer attribution={config.tileAttribution} url={config.tileUrl} />
        <MapEvents onMapClick={onMapClick} isAddingCamera={isAddingCamera} />
        <MapFocus
          selectedCamera={selectedCamera}
          mapCenter={mapCenter}
          draftCamera={draftCamera}
          isAddingCamera={!!isAddingCamera}
          focusTrigger={focusTrigger}
        />

        {showHeatmap && <HeatmapLayer cameras={cameras} />}

        {/* Render existing cameras */}
        {!draftCamera &&
          cameras.map((camera) => (
            <React.Fragment key={camera.id}>
              <Marker
                position={[camera.latitude, camera.longitude]}
                icon={createCustomIcon(camera.type, camera.direction ?? undefined)}
                eventHandlers={{
                  click: () => onSelectCamera(camera),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[150px]" role="status" aria-live="polite">
                    <h3 className="font-bold text-lg capitalize">
                      {camera.name || `${camera.type.replace('_', ' ')} Camera`}
                    </h3>
                    {camera.address && (
                      <p className="text-sm text-gray-600">{camera.address}</p>
                    )}
                    {camera.policeReferenceNumber && (
                      <p className="text-sm mt-1">
                        Ref: {camera.policeReferenceNumber}
                      </p>
                    )}
                    {onEditCamera && canEditCamera && canEditCamera(camera) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCamera(camera);
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-1 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md text-sm font-medium border border-blue-200 hover:bg-blue-200 transition-colors"
                      >
                        <Edit2 size={14} aria-hidden="true" />
                        Amend Camera
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>

              {camera.direction !== undefined &&
                camera.direction !== null &&
                !Number.isNaN(camera.direction) &&
                camera.fieldOfView !== undefined &&
                camera.fieldOfView !== null &&
                camera.fieldOfView > 0 && (
                  <Polygon
                    key={`polygon-${camera.id}-${camera.direction}-${camera.fieldOfView}-${camera.viewDistance}`}
                    positions={calculateFovPolygon(
                      camera.latitude,
                      camera.longitude,
                      camera.direction,
                      camera.fieldOfView,
                      camera.viewDistance || 30,
                    )}
                    pathOptions={{
                      color: selectedCamera?.id === camera.id ? '#ef4444' : '#3b82f6',
                      fillColor:
                        selectedCamera?.id === camera.id ? '#ef4444' : '#3b82f6',
                      fillOpacity: selectedCamera?.id === camera.id ? 0.4 : 0.2,
                      weight: selectedCamera?.id === camera.id ? 2 : 1,
                      className:
                        selectedCamera?.id === camera.id
                          ? 'cone-glow-selected'
                          : 'cone-glow-default',
                    }}
                  />
                )}
            </React.Fragment>
          ))}

        {/* Render draft camera for adding/editing */}
        {draftCamera && (
          <React.Fragment>
            <Marker
              position={[draftCamera.lat, draftCamera.lng]}
              icon={createCustomIcon(draftCamera.type, draftCamera.direction, true)}
            />
            {draftCamera.direction !== undefined &&
              draftCamera.direction !== null &&
              !Number.isNaN(draftCamera.direction) &&
              draftCamera.fieldOfView !== undefined &&
              draftCamera.fieldOfView !== null &&
              draftCamera.fieldOfView > 0 && (
                <Polygon
                  key={`draft-polygon-${draftCamera.lat}-${draftCamera.lng}-${draftCamera.direction}-${draftCamera.fieldOfView}-${draftCamera.viewDistance}`}
                  positions={calculateFovPolygon(
                    draftCamera.lat,
                    draftCamera.lng,
                    draftCamera.direction,
                    draftCamera.fieldOfView,
                    draftCamera.viewDistance || 30,
                  )}
                  pathOptions={{
                    color: '#f59e0b',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.4,
                    weight: 2,
                    dashArray: '4',
                    className: 'cone-glow-draft',
                  }}
                />
              )}
            {handlePos && onDraftDirectionChange && (
              <DraggableHandle
                position={handlePos}
                icon={handleIcon}
                onDrag={(lat, lng) => {
                  const newBearing = calculateBearing(
                    draftCamera.lat,
                    draftCamera.lng,
                    lat,
                    lng,
                  );
                  const newDistance = calculateDistance(
                    draftCamera.lat,
                    draftCamera.lng,
                    lat,
                    lng,
                  );
                  onDraftDirectionChange(
                    Math.round(newBearing),
                    Math.round(newDistance),
                  );
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
        <div
          role="status"
          className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-[1000] font-medium pointer-events-none"
        >
          Click on the map to place the camera
        </div>
      )}
      {draftCamera && (
        <div
          role="status"
          className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white px-4 py-2 rounded-full shadow-lg z-[1000] font-medium pointer-events-none"
        >
          Drag the red handle to aim the camera
        </div>
      )}
    </div>
  );
}
