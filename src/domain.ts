export type CameraKind = "business" | "council";
export type Point = { lat: number; lng: number };
export interface CameraRecord extends Point {
  id: string;
  kind: CameraKind;
  name: string;
  address: string;
  publicPhone: string;
  contactSource: string;
  placeSource?: string;
  assetReference: string;
  direction: number;
  fieldOfView: number;
  viewDistance: number;
  retentionDays: number | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasPhoto: boolean;
  source: string;
  revision: number;
}
export const kindLabel = (kind: CameraKind) =>
  kind === "council" ? "Public authority" : "Business";
export const dateLabel = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not yet verified";
export const isStale = (c: CameraRecord) =>
  !c.verifiedAt || Date.now() - Date.parse(c.verifiedAt) > 180 * 86400000;
export function distance(a: Point, b: Point) {
  const r = Math.PI / 180,
    p1 = a.lat * r,
    p2 = b.lat * r;
  const h =
    Math.sin((p2 - p1) / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function alongRoute(p: Point, route: Point[]) {
  let nearest = Infinity,
    progress = 0,
    travelled = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      scale = 111195 * Math.cos((p.lat * Math.PI) / 180);
    const ax = (a.lng - p.lng) * scale,
      ay = (a.lat - p.lat) * 111195;
    const bx = (b.lng - p.lng) * scale,
      by = (b.lat - p.lat) * 111195;
    const dx = bx - ax,
      dy = by - ay,
      len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy),
      segment = distance(a, b);
    if (d < nearest) {
      nearest = d;
      progress = travelled + t * segment;
    }
    travelled += segment;
  }
  return { distance: nearest, progress };
}
export function routeMatches(
  cameras: CameraRecord[],
  route: Point[],
  radius: number,
) {
  if (route.length < 2) return [];
  return cameras
    .map((camera) => ({ camera, ...alongRoute(camera, route) }))
    .filter((x) => x.distance <= radius)
    .sort((a, b) => a.progress - b.progress || a.distance - b.distance);
}
export function safeCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function cameraCSV(cameras: CameraRecord[], route: Point[] = []) {
  const cols = [
    "Camera ID",
    "Type",
    "Site",
    "Public address",
    "Public telephone",
    "Contact source",
    "Place attribution",
    "Police asset reference",
    "Latitude",
    "Longitude",
    "Bearing degrees",
    "Field of view degrees",
    "Approximate range metres",
    "Retention days (reported)",
    "Last verified",
    "Distance from route metres",
  ];
  return (
    "\ufeff" +
    [
      cols.map(safeCell).join(","),
      ...cameras.map((c) =>
        [
          c.id,
          kindLabel(c.kind),
          c.name,
          c.address,
          c.publicPhone,
          c.contactSource,
          c.placeSource,
          c.assetReference,
          c.lat,
          c.lng,
          c.direction,
          c.fieldOfView,
          c.viewDistance,
          c.retentionDays,
          c.verifiedAt,
          route.length > 1 ? Math.round(alongRoute(c, route).distance) : "",
        ]
          .map(safeCell)
          .join(","),
      ),
    ].join("\r\n")
  );
}
