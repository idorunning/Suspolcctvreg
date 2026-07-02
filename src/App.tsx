import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Crosshair, LogOut, Map as MapIcon, PanelLeftClose, PanelLeftOpen,
  Settings as SettingsIcon, Smartphone,
} from 'lucide-react';
import type { AreaFilter, Camera } from './types';
import ConnectFolder from './components/ConnectFolder';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import AddCameraModal from './components/AddCameraModal';
import OverviewPanel from './components/OverviewPanel';
import SettingsPanel from './components/SettingsPanel';
import CompanionApp from './components/CompanionApp';
import {
  bootFromState,
  createCamera,
  deleteCamera,
  listCameras,
  subscribe,
  updateCamera,
  verifyCamera,
} from './services/localApi';
import { forgetFolder } from './services/storage';
import { watchForRemoteChanges } from './services/concurrency';
import { reloadFromDisk } from './services/storage';
import { APP_TITLE, CREATOR_CREDIT, NAV } from './copy';
import type { PossibleSite } from './components/PossibleSitesLayer';

type Mode = 'registry' | 'companion';

type Draft = Partial<Camera> | null;

export default function App() {
  const [connected, setConnected] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [mode, setMode] = useState<Mode>('registry');

  // Camera selection / draft state
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [isEditingCamera, setIsEditingCamera] = useState(false);
  const [isMovingPin, setIsMovingPin] = useState(false);
  const [newCameraLocation, setNewCameraLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [draftCameraData, setDraftCameraData] = useState<Draft>(null);
  const [draftDirection, setDraftDirection] = useState<number | undefined>(undefined);
  const [draftDistance, setDraftDistance] = useState<number | undefined>(undefined);

  // Area filter (circle)
  const [area, setArea] = useState<AreaFilter | null>(null);
  const [isDrawingArea, setIsDrawingArea] = useState(false);

  // Overlays
  const [showSettings, setShowSettings] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showPossibleSites, setShowPossibleSites] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to local camera state once connected
  useEffect(() => {
    if (!connected) return;
    setCameras(listCameras());
    const unsub = subscribe((next) => setCameras(next));
    return unsub;
  }, [connected]);

  // Watch the data file for changes from teammates
  useEffect(() => {
    if (!connected) return;
    const stop = watchForRemoteChanges(() => setRemoteChanged(true));
    return stop;
  }, [connected]);

  const handleConnected = useCallback(() => {
    setConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setCameras([]);
    setSelectedCamera(null);
    setArea(null);
    setShowSettings(false);
  }, []);

  const handleForgetFolder = useCallback(async () => {
    await forgetFolder();
    handleDisconnect();
  }, [handleDisconnect]);

  const handleReload = useCallback(async () => {
    try {
      const fresh = await reloadFromDisk();
      bootFromState(fresh);
      setRemoteChanged(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reload.');
    }
  }, []);

  const handleSaveCamera = useCallback(
    async (data: Partial<Camera>, initialsValue: string) => {
      try {
        const attributed = initialsValue.trim() || null;
        if (isEditingCamera && selectedCamera) {
          const updated = await updateCamera(selectedCamera.id, { ...data, lastEditedBy: attributed });
          setSelectedCamera(updated);
          setIsEditingCamera(false);
        } else {
          await createCamera(data, attributed);
          setNewCameraLocation(null);
          setIsAddingCamera(false);
        }
        setDraftCameraData(null);
        setDraftDirection(undefined);
        setDraftDistance(undefined);
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    },
    [isEditingCamera, selectedCamera],
  );

  const handleDeleteCamera = useCallback(async () => {
    if (!selectedCamera) return;
    if (!window.confirm('Delete this camera? This cannot be undone.')) return;
    try {
      await deleteCamera(selectedCamera.id);
      setSelectedCamera(null);
      setIsEditingCamera(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
    }
  }, [selectedCamera]);

  const handleVerifyCamera = useCallback(async () => {
    if (!selectedCamera) return;
    try {
      const updated = await verifyCamera(selectedCamera.id);
      setSelectedCamera(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }, [selectedCamera]);

  const handleAddFromPossibleSite = (site: PossibleSite) => {
    setIsAddingCamera(true);
    setSelectedCamera(null);
    setNewCameraLocation({ lat: site.lat, lng: site.lng });
    setDraftCameraData({
      type: site.kind === 'public_cctv' ? 'police_council' : site.kind === 'fuel' ? 'pfs' : 'cctv',
      name: site.name,
    });
    setShowPossibleSites(false);
  };

  // Memoised draft for the map
  const draftOrigin = useMemo(() => {
    if (newCameraLocation) return { lat: newCameraLocation.lat, lng: newCameraLocation.lng };
    if (isEditingCamera && selectedCamera)
      return { lat: selectedCamera.latitude, lng: selectedCamera.longitude };
    return null;
  }, [newCameraLocation, isEditingCamera, selectedCamera]);

  const draftCamera = useMemo(() => {
    if (!draftOrigin) return null;
    return {
      lat: draftOrigin.lat,
      lng: draftOrigin.lng,
      direction: draftDirection !== undefined ? draftDirection : 0,
      fieldOfView:
        (draftCameraData?.fieldOfView as number | undefined) ??
        (isEditingCamera && selectedCamera ? selectedCamera.fieldOfView ?? 90 : 90),
      viewDistance:
        draftDistance ??
        (isEditingCamera && selectedCamera ? selectedCamera.viewDistance ?? 30 : 30),
      type:
        (draftCameraData?.type as string | undefined) ??
        (isEditingCamera && selectedCamera ? selectedCamera.type : 'cctv'),
    };
  }, [draftOrigin, draftDirection, draftDistance, draftCameraData, isEditingCamera, selectedCamera]);

  if (!connected) return <ConnectFolder onConnected={handleConnected} />;

  if (mode === 'companion') {
    return <CompanionApp onSwitchMode={() => setMode('registry')} />;
  }

  // Bridge for MapComponent's internal circle filter UI -> our area state
  const circleFilter = area ? { center: [area.lat, area.lng] as [number, number], radius: area.radiusM } : null;
  const setCircleFilter = (f: { center: [number, number]; radius: number } | null) =>
    setArea(f ? { lat: f.center[0], lng: f.center[1], radiusM: f.radius } : null);

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden relative">
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-10" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div
        className={`absolute md:relative z-20 h-full transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'
        }`}
      >
        <Sidebar
          cameras={cameras}
          onSelectCamera={(cam) => {
            setSelectedCamera(cam);
            setFocusTrigger((p) => p + 1);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onAddCameraClick={() => {
            setIsAddingCamera(true);
            setSelectedCamera(null);
            setDraftDirection(undefined);
            setDraftDistance(undefined);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          selectedCameraId={selectedCamera?.id}
          onLocationFound={(lat, lng) => {
            setMapCenter([lat, lng]);
            setSelectedCamera(null);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          area={area}
          onClearArea={() => setArea(null)}
        />
      </div>

      <div className="flex-1 relative flex flex-col min-w-0">
        <header className="bg-white h-14 border-b border-slate-200 flex items-center justify-between px-3 sm:px-5 shadow-sm z-10">
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar flex-1">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label={isSidebarOpen ? 'Hide list' : 'Show list'}
            >
              {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <h1 className="font-bold text-slate-900 text-sm sm:text-base">{APP_TITLE}</h1>

            {isAddingCamera && (
              <span className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium border border-amber-200 whitespace-nowrap">
                <Crosshair size={12} />
                Click the map to place
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCamera(false);
                    setNewCameraLocation(null);
                    setDraftCameraData(null);
                    setDraftDirection(undefined);
                    setDraftDistance(undefined);
                  }}
                  className="ml-1 text-amber-900 underline"
                >
                  cancel
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowOverview(true)}
              className="hidden sm:flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 transition-colors"
            >
              <BarChart3 size={14} />
              Overview
            </button>

            <button
              type="button"
              onClick={() => setShowPossibleSites((v) => !v)}
              aria-pressed={showPossibleSites}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showPossibleSites
                  ? 'bg-orange-100 text-orange-800 border-orange-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Show petrol stations, supermarkets and existing public CCTV near the map"
            >
              <MapIcon size={14} />
              Possible sites
            </button>

            <button
              type="button"
              onClick={() => setMode('companion')}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow transition-colors"
              title="Quick add"
            >
              <Smartphone size={14} />
              <span className="hidden sm:inline">Quick add</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <SettingsIcon size={16} />
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              aria-label={NAV.signOut}
              title={NAV.signOut}
              className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 relative">
          <MapComponent
            cameras={cameras}
            selectedCamera={selectedCamera}
            onSelectCamera={(cam) => {
              setSelectedCamera(cam);
              setFocusTrigger((p) => p + 1);
            }}
            isAddingCamera={isAddingCamera || isMovingPin}
            mapCenter={mapCenter}
            focusTrigger={focusTrigger}
            onEditCamera={(camera) => {
              setSelectedCamera(camera);
              setIsEditingCamera(true);
              setDraftDirection(camera.direction ?? 0);
              setDraftDistance(camera.viewDistance ?? 30);
            }}
            onMapClick={(lat, lng) => {
              if (isAddingCamera || isMovingPin) {
                setNewCameraLocation({ lat, lng });
                if (draftDirection === undefined) setDraftDirection(0);
                if (isMovingPin) setIsMovingPin(false);
              }
            }}
            draftCamera={draftCamera}
            onDraftDirectionChange={(dir, dist, fov) => {
              setDraftDirection(dir);
              if (dist !== undefined) setDraftDistance(dist);
              if (fov !== undefined)
                setDraftCameraData((prev) => ({ ...(prev ?? {}), fieldOfView: fov }));
            }}
            circleFilter={circleFilter}
            onCircleFilterChange={setCircleFilter}
            isDrawingCircle={isDrawingArea}
            setIsDrawingCircle={setIsDrawingArea}
            showPossibleSites={showPossibleSites}
            onAddFromPossibleSite={handleAddFromPossibleSite}
          />

          {remoteChanged && (
            <div
              role="status"
              className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-100 border border-amber-300 text-amber-900 text-sm px-3 py-2 rounded-lg shadow flex items-center gap-2 z-[1500]"
            >
              <span>A teammate just saved an update.</span>
              <button
                type="button"
                onClick={handleReload}
                className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold px-2 py-1 rounded"
              >
                Reload
              </button>
            </div>
          )}

          {isMovingPin && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
              <button
                type="button"
                onClick={() => setIsMovingPin(false)}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-full font-bold shadow-xl flex items-center gap-2"
              >
                <Crosshair size={18} />
                Done moving pin
              </button>
            </div>
          )}
        </main>
      </div>

      {draftOrigin && !isMovingPin && (
        <AddCameraModal
          lat={draftOrigin.lat}
          lng={draftOrigin.lng}
          initialData={isEditingCamera ? selectedCamera : (draftCameraData as Camera | null)}
          draftDirection={draftDirection}
          draftDistance={draftDistance}
          onSetPosition={(current) => {
            setDraftCameraData(current);
            setIsMovingPin(true);
          }}
          onClose={() => {
            setNewCameraLocation(null);
            setIsAddingCamera(false);
            setIsEditingCamera(false);
            setDraftCameraData(null);
            setDraftDirection(undefined);
            setDraftDistance(undefined);
            setIsMovingPin(false);
          }}
          onSave={handleSaveCamera}
          onDelete={isEditingCamera ? handleDeleteCamera : undefined}
          onVerify={isEditingCamera ? handleVerifyCamera : undefined}
        />
      )}

      {showOverview && (
        <OverviewPanel
          cameras={cameras}
          usersCount={1}
          onClose={() => setShowOverview(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onDisconnect={handleForgetFolder}
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded shadow z-[3000] max-w-md text-sm"
        >
          <div className="flex justify-between items-start gap-3">
            <p>{error}</p>
            <button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-700">
              ×
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-1 left-2 text-[10px] text-slate-400 pointer-events-none">
        {CREATOR_CREDIT}
      </div>
    </div>
  );
}
