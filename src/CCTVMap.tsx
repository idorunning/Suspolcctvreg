import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { CameraRecord, Point } from "./domain";
import { Layers, Minus, Plus, LocateFixed, MousePointer2 } from "lucide-react";
const cameraSVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 7 13-3 4 8-13 3zM8 15v4h8M16 19v-5M3 7l-1 5 4 1"/></svg>';
function wedge(c: CameraRecord): L.LatLngExpression[] {
  const points: L.LatLngExpression[] = [[c.lat, c.lng]];
  for (
    let d = c.direction - c.fieldOfView / 2;
    d <= c.direction + c.fieldOfView / 2;
    d += Math.max(c.fieldOfView / 20, 1)
  ) {
    const a = (d * Math.PI) / 180;
    points.push([
      c.lat + (Math.cos(a) * c.viewDistance) / 111195,
      c.lng +
        (Math.sin(a) * c.viewDistance) /
          (111195 * Math.cos((c.lat * Math.PI) / 180)),
    ]);
  }
  points.push([c.lat, c.lng]);
  return points;
}
interface Props {
  cameras: CameraRecord[];
  selected: string | null;
  onSelect: (c: CameraRecord) => void;
  onPoint: (p: Point) => void;
  picking: string | null;
  route: Point[];
  waypoints: Point[];
  radius: number;
  focus: { point: Point; zoom?: number; key: number } | null;
  tiles: boolean;
  onLocate: () => void;
  onCentreChange: (p: Point) => void;
}
export default function CCTVMap(props: Props) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    cluster = useRef<L.MarkerClusterGroup | null>(null),
    refs = useRef(props),
    cones = useRef<L.LayerGroup | null>(null),
    routeLayer = useRef<L.LayerGroup | null>(null);
  refs.current = props;
  const [zoom, setZoom] = useState(15),
    [tileError, setTileError] = useState(false),
    [showCoverage, setShowCoverage] = useState(false);
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      maxZoom: 20,
      minZoom: 6,
    }).setView([50.8141, -0.3746], 15);
    map.current = m;
    const group = L.markerClusterGroup({
      maxClusterRadius: (z) => (z < 13 ? 65 : z < 16 ? 48 : 32),
      disableClusteringAtZoom: 19,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      iconCreateFunction: (c) =>
        L.divIcon({
          className: "cluster",
          html: `<span>${c.getChildCount()}</span>`,
          iconSize: [44, 44],
        }),
    });
    cluster.current = group;
    m.addLayer(group);
    cones.current = L.layerGroup().addTo(m);
    routeLayer.current = L.layerGroup().addTo(m);
    m.on("click", (e) => {
      if (refs.current.picking) refs.current.onPoint(e.latlng);
    });
    m.on("zoomend", () => setZoom(m.getZoom()));
    m.on("moveend", () => {
      const p = m.getCenter();
      refs.current.onCentreChange({ lat: p.lat, lng: p.lng });
    });
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(el.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !props.tiles) return;
    setTileError(false);
    const layer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxNativeZoom: 19,
        maxZoom: 20,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      },
    ).addTo(m);
    layer.on("tileerror", () => setTileError(true));
    return () => {
      m.removeLayer(layer);
    };
  }, [props.tiles]);
  useEffect(() => {
    const m = map.current,
      g = cluster.current;
    if (!m || !g) return;
    g.clearLayers();
    props.cameras.forEach((c) => {
      const selected = c.id === props.selected;
      const size = zoom < 14 ? 26 : zoom < 17 ? 32 : 38;
      const marker = L.marker([c.lat, c.lng], {
        title: c.name,
        keyboard: true,
        icon: L.divIcon({
          className: `camera-pin ${c.kind} ${selected ? "selected" : ""}`,
          html: cameraSVG,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
      });
      const tip = document.createElement("span");
      tip.textContent = c.name;
      marker.bindTooltip(tip, { direction: "top", offset: [0, -16] });
      marker.on("click", () => {
        if (refs.current.picking) refs.current.onPoint(c);
        else refs.current.onSelect(c);
      });
      g.addLayer(marker);
    });
  }, [props.cameras, props.selected, zoom]);
  useEffect(() => {
    const g = cones.current;
    if (!g) return;
    g.clearLayers();
    props.cameras
      .filter((c) => c.id === props.selected || (showCoverage && zoom >= 17))
      .forEach((c) =>
        L.polygon(wedge(c), {
          color: c.kind === "council" ? "#185b92" : "#087f80",
          fillOpacity: 0.15,
          weight: 1,
          interactive: false,
        }).addTo(g),
      );
  }, [props.cameras, props.selected, showCoverage, zoom]);
  useEffect(() => {
    const g = routeLayer.current,
      m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    if (props.route.length > 1) {
      const line = props.route.map((p) => [p.lat, p.lng] as L.LatLngTuple);
      const metresPerPixel =
        (156543.03392 * Math.cos((props.route[0].lat * Math.PI) / 180)) /
        2 ** zoom;
      L.polyline(line, {
        color: "#4389ef",
        weight: Math.max(8, (2 * props.radius) / metresPerPixel),
        opacity: 0.15,
        lineCap: "round",
        interactive: false,
      }).addTo(g);
      L.polyline(line, {
        color: "#fff",
        weight: 10,
        opacity: 0.95,
        interactive: false,
      }).addTo(g);
      L.polyline(line, {
        color: "#146be9",
        weight: 5,
        opacity: 1,
        lineCap: "round",
        interactive: false,
      }).addTo(g);
    }
    props.waypoints.forEach((p, i) =>
      L.marker([p.lat, p.lng], {
        interactive: false,
        icon: L.divIcon({
          className: "route-pin",
          html: `<span><b>${i === 0 ? "A" : i === props.waypoints.length - 1 ? "B" : i}</b></span>`,
          iconSize: [30, 36],
          iconAnchor: [15, 36],
        }),
      }).addTo(g),
    );
  }, [props.route, props.waypoints, props.radius, zoom]);
  useEffect(() => {
    if (props.route.length > 1 && map.current)
      map.current.fitBounds(
        L.latLngBounds(props.route.map((p) => [p.lat, p.lng] as L.LatLngTuple)),
        { padding: [55, 55], maxZoom: 17, animate: false },
      );
  }, [props.route]);
  useEffect(() => {
    const f = props.focus;
    if (f && map.current)
      map.current.flyTo([f.point.lat, f.point.lng], f.zoom || 18, {
        duration: 0.5,
      });
  }, [props.focus]);
  return (
    <div className={"map-wrap " + (props.picking ? "picking" : "")}>
      <div
        ref={el}
        className="map-canvas"
        aria-label="Interactive CCTV camera map"
      />
      <div className="map-context">
        <span className="status-dot" /> Worthing & surrounding area{" "}
        <span className="context-divider" />{" "}
        <strong>{props.cameras.length}</strong> cameras shown
      </div>
      {props.picking && (
        <div className="pick-banner" role="status">
          <MousePointer2 size={17} />
          {props.picking}
        </div>
      )}
      {tileError && (
        <div className="map-error" role="status">
          Map tiles are unavailable. The camera list and coordinates still work.
        </div>
      )}
      <div className="map-tools">
        <button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
          <Plus />
        </button>
        <button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
          <Minus />
        </button>
        <hr />
        <button aria-label="Find my location" onClick={props.onLocate}>
          <LocateFixed />
        </button>
        <button
          aria-label="Toggle camera POV / estimated coverage"
          title="Camera POV — estimated direction and field of view"
          aria-pressed={showCoverage}
          onClick={() => setShowCoverage((v) => !v)}
        >
          <Layers />
        </button>
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-dot business" />
          Business
        </span>
        <span>
          <i className="legend-dot council" />
          Public authority
        </span>
        <span className="legend-clusters">
          <i className="legend-cluster">3</i>Zoom to separate
        </span>
      </div>
      {showCoverage && (
        <div className="coverage-note">
          {zoom < 17
            ? "Zoom in to see approximate view cones."
            : "View cones are estimates, not confirmed footage coverage."}
        </div>
      )}
    </div>
  );
}
