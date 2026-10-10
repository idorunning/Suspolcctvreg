const fields = new Set([
  "kind",
  "name",
  "address",
  "publicPhone",
  "contactSource",
  "assetReference",
  "lat",
  "lng",
  "direction",
  "fieldOfView",
  "viewDistance",
  "retentionDays",
  "publicFacingConfirmed",
  "contactConfirmed",
  "photoConfirmed",
  "photo",
  "removePhoto",
  "revision",
  "placeSource",
]);
export function validateCamera(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid camera record.");
  for (const key of Object.keys(input))
    if (!fields.has(key)) throw new Error("Unsupported field: " + key);
  if (!["business", "council"].includes(input.kind))
    throw new Error(
      "Only public authority and public-facing business CCTV may be added.",
    );
  if (input.publicFacingConfirmed !== true)
    throw new Error(
      "Confirm this is public-facing CCTV, not ANPR or a residential camera.",
    );
  const str = (key, max) => {
    const s = input[key] ?? "";
    if (typeof s !== "string" || s.length > max || /[<>\x00-\x1f]/.test(s))
      throw new Error("Check " + key + ".");
    return s.trim();
  };
  const name = str("name", 100),
    address = str("address", 200),
    assetReference = str("assetReference", 40),
    contactSource = str("contactSource", 250);
  if (name.length < 2)
    throw new Error("Enter the public site or business name.");
  if (
    /@|\b(?:victim|suspect|witness|date of birth|dob|anpr|doorbell|ring camera|residential|private home|children.?s home)\b/i.test(
      name + " " + address,
    )
  )
    throw new Error(
      "Personal, residential and ANPR information is not permitted.",
    );
  if (assetReference && !/^[A-Z0-9][A-Z0-9/_-]{1,39}$/i.test(assetReference))
    throw new Error(
      "Use an asset reference only, without names or case details.",
    );
  const placeSource = str("placeSource", 100);
  if (
    placeSource &&
    !/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(
      placeSource,
    )
  )
    throw new Error("Invalid place attribution.");
  const publicPhone = str("publicPhone", 24).replace(/[ ()-]/g, "");
  if (
    publicPhone &&
    (!/^(?:0|\+44)(?:1\d{8,9}|2\d{9}|3\d{9}|800\d{6,7}|808\d{7})$/.test(
      publicPhone,
    ) ||
      input.contactConfirmed !== true)
  )
    throw new Error(
      "Use a verified public organisation landline or non-geographic number; no personal or mobile numbers.",
    );
  if (contactSource) {
    let url;
    try {
      url = new URL(contactSource);
    } catch {
      throw new Error("Enter a valid public organisation website.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      /@/.test(contactSource)
    )
      throw new Error(
        "Use an HTTPS public organisation URL without query strings or personal details.",
      );
  }
  if (publicPhone && !contactSource)
    throw new Error(
      "Provide the public organisation website used to verify this number.",
    );
  const num = (key, min, max, fallback) => {
    const v = input[key] ?? fallback;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
      throw new Error("Check " + key + ".");
    return v;
  };
  const lat = num("lat", 49, 61),
    lng = num("lng", -9, 3);
  const direction = num("direction", 0, 359, 0),
    fieldOfView = num("fieldOfView", 1, 360, 90),
    viewDistance = num("viewDistance", 1, 300, 30);
  const retentionDays = input.retentionDays ?? null;
  if (
    retentionDays !== null &&
    ![1, 3, 7, 14, 28, 30, 60, 90].includes(retentionDays)
  )
    throw new Error("Choose a supported retention period or unknown.");
  if (
    input.photo &&
    (input.photoConfirmed !== true ||
      typeof input.photo !== "string" ||
      !input.photo.startsWith("data:image/jpeg;base64,") ||
      input.photo.length > 500000)
  )
    throw new Error(
      "Use a reviewed JPEG photo under 350 KB, without identifiable people, plates or private information.",
    );
  return {
    kind: input.kind,
    name,
    address,
    publicPhone,
    contactSource,
    placeSource,
    assetReference,
    lat,
    lng,
    direction,
    fieldOfView,
    viewDistance,
    retentionDays,
  };
}
// Remove EXIF, XMP, ICC and comments server-side. Validate a bounded JPEG frame.
export function sanitiseJPEG(bytes) {
  if (bytes.length > 350000 || bytes[0] !== 255 || bytes[1] !== 216)
    throw new Error("Invalid or oversized JPEG.");
  const parts = [bytes.slice(0, 2)];
  let p = 2,
    frame = false;
  while (p < bytes.length) {
    if (bytes[p] !== 255) throw new Error("Invalid JPEG structure.");
    const marker = bytes[p + 1];
    if (marker === 0xda) {
      if (
        !frame ||
        bytes[bytes.length - 2] !== 255 ||
        bytes[bytes.length - 1] !== 217
      )
        throw new Error("Incomplete JPEG.");
      parts.push(bytes.slice(p));
      const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
      let pos = 0;
      for (const x of parts) {
        out.set(x, pos);
        pos += x.length;
      }
      return out;
    }
    const len = bytes[p + 2] * 256 + bytes[p + 3];
    if (len < 2 || p + 2 + len > bytes.length)
      throw new Error("Invalid JPEG segment.");
    if (marker === 0xc0 || marker === 0xc2) {
      const h = bytes[p + 5] * 256 + bytes[p + 6],
        w = bytes[p + 7] * 256 + bytes[p + 8];
      if (!w || !h || w > 1600 || h > 1600)
        throw new Error("Photo dimensions must be at most 1600 pixels.");
      frame = true;
    }
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe)
      parts.push(bytes.slice(p, p + 2 + len));
    p += 2 + len;
  }
  throw new Error("Invalid JPEG.");
}
