import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Point } from "./domain";
export type Placement = Point & {
  direction: number;
  fieldOfView: number;
  viewDistance: number;
};
function at(p: Placement, bearing: number, metres: number): L.LatLngTuple {
  const a = (bearing * Math.PI) / 180;
  return [
    p.lat + (Math.cos(a) * metres) / 111195,
    p.lng +
      (Math.sin(a) * metres) / (111195 * Math.cos((p.lat * Math.PI) / 180)),
  ];
}
function bearing(p: Point, q: Point) {
  return (
    ((Math.atan2(
      (q.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180),
      q.lat - p.lat,
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}
export default function CameraPlacement({
  value,
  onChange,
  tiles,
  mode,
  placed,
  focus,
}: {
  value: Placement;
  onChange: (v: Partial<Placement>, location: boolean) => void;
  tiles: boolean;
  mode: "location" | "view";
  placed: boolean;
  focus: { point: Point; key: number } | null;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layers = useRef<L.LayerGroup | null>(null);
  const refs = useRef({ value, onChange, mode, placed });
  refs.current = { value, onChange, mode, placed };
  const [error, setError] = useState("");
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, {
      scrollWheelZoom: false,
      maxZoom: 20,
    }).setView([value.lat, value.lng], 19);
    map.current = m;
    layers.current = L.layerGroup().addTo(m);
    m.on("click", (e) => {
      if (refs.current.mode === "location")
        refs.current.onChange({ lat: e.latlng.lat, lng: e.latlng.lng }, true);
    });
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
    };
  }, []);
  useEffect(() => {
    if (!map.current || !tiles) return;
    const layer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxNativeZoom: 19,
        maxZoom: 20,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      },
    ).addTo(map.current);
    layer.on("tileerror", () =>
      setError(
        "Map tiles unavailable. Try again before confirming the position.",
      ),
    );
    return () => {
      layer.remove();
    };
  }, [tiles]);
  useEffect(() => {
    if (mode === "view" && map.current)
      map.current.fitBounds(
        L.latLngBounds([
          at(value, 0, value.viewDistance),
          at(value, 180, value.viewDistance),
          at(value, 90, value.viewDistance),
          at(value, 270, value.viewDistance),
        ]),
        { padding: [45, 45], maxZoom: 19 },
      );
  }, [mode]);
  useEffect(() => {
    if (focus && map.current)
      map.current.setView([focus.point.lat, focus.point.lng], 19);
  }, [focus]);
  useEffect(() => {
    const g = layers.current;
    if (!g) return;
    g.clearLayers();
    if (!placed) return;
    const marker = L.marker([value.lat, value.lng], {
      draggable: mode === "location",
      title: "Camera location — drag to move",
      icon: L.divIcon({
        className: "placement-pin",
        html: "<span>●</span>",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    }).addTo(g);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onChange({ lat: p.lat, lng: p.lng }, true);
    });
    if (mode !== "view") return;
    const conePoints = (v: Placement): L.LatLngExpression[] => [
      [v.lat, v.lng],
      ...Array.from({ length: 33 }, (_, i) =>
        at(
          v,
          v.direction - v.fieldOfView / 2 + (v.fieldOfView * i) / 32,
          v.viewDistance,
        ),
      ),
      [v.lat, v.lng],
    ];
    const cone = L.polygon(conePoints(value), {
      color: "#174d80",
      fillColor: "#74abe0",
      fillOpacity: 0.35,
      weight: 2,
      interactive: false,
    }).addTo(g);
    const handles: { kind: string; marker: L.Marker }[] = [];
    for (const [kind, label, b] of [
      ["aim", "↗", value.direction],
      ["width", "↔", value.direction + value.fieldOfView / 2],
    ] as const) {
      const h = L.marker(at(value, b, value.viewDistance), {
        draggable: true,
        title:
          kind === "aim"
            ? "Drag to aim camera and set range"
            : "Drag to widen or narrow view",
        icon: L.divIcon({
          className: "cone-handle " + kind,
          html: `<span>${label}</span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      }).addTo(g);
      handles.push({ kind, marker: h });
      let pending: Partial<Placement> = {};
      h.on("drag", () => {
        const p = h.getLatLng(),
          v = refs.current.value;
        const angle = bearing(v, p);
        pending =
          kind === "aim"
            ? {
                direction: Math.round(angle) % 360,
                viewDistance: Math.max(
                  1,
                  Math.min(
                    300,
                    Math.round(L.latLng(v.lat, v.lng).distanceTo(p)),
                  ),
                ),
              }
            : {
                fieldOfView: Math.max(
                  1,
                  Math.min(
                    360,
                    Math.round(
                      Math.abs(((angle - v.direction + 540) % 360) - 180) * 2,
                    ),
                  ),
                ),
              };
        const next = { ...v, ...pending };
        cone.setLatLngs(conePoints(next));
        for (const other of handles)
          if (other.marker !== h)
            other.marker.setLatLng(
              at(
                next,
                next.direction +
                  (other.kind === "width" ? next.fieldOfView / 2 : 0),
                next.viewDistance,
              ),
            );
      });
      h.on("dragend", () => onChange(pending, false));
    }
  }, [
    value.lat,
    value.lng,
    value.direction,
    value.fieldOfView,
    value.viewDistance,
    mode,
    placed,
  ]);
  return (
    <div>
      <div
        ref={el}
        className="placement-map"
        aria-label={
          mode === "location"
            ? "Choose and adjust camera location on map"
            : "Drag camera field of view cone on map"
        }
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
