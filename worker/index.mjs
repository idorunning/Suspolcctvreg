import { validateCamera, sanitiseJPEG } from "./validation.mjs";
const enc = new TextEncoder();
const hex = (b) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(
    "",
  );
const hash = async (s) =>
  hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const security = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Permissions-Policy": "geolocation=(self), camera=(self), microphone=()",
};
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...security, "Content-Type": "application/json", ...headers },
  });
const cookie = (token, maxAge) =>
  `__Host-cctv=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
function sameOrigin(req) {
  return req.headers.get("Origin") === new URL(req.url).origin;
}
async function payload(req, max = 550000) {
  if (Number(req.headers.get("Content-Length")) > max)
    throw new Error("Request too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Request body required.");
  let size = 0;
  const chunks = [];
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error("Request too large.");
    }
    chunks.push(r.value);
  }
  const buffer = new Uint8Array(size);
  let n = 0;
  for (const c of chunks) {
    buffer.set(c, n);
    n += c.length;
  }
  return JSON.parse(new TextDecoder().decode(buffer));
}
async function login(req, env) {
  if (!env.AUTH_CREDENTIAL || !env.RATE_SECRET)
    return json({ error: "Test access has not been configured." }, 503);
  const body = await payload(req, 2048);
  if (typeof body.password !== "string" || body.password.length > 200)
    return json({ error: "Check the password." }, 400);
  const now = Date.now(),
    window = Math.floor(now / 900000);
  const key = await hash(
    env.RATE_SECRET +
      "|" +
      (req.headers.get("CF-Connecting-IP") || "local") +
      "|" +
      window,
  );
  const counter = await env.DB.prepare(
    "INSERT INTO login_limits (key,attempts,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
  )
    .bind(key, now + 900000)
    .first();
  if (counter.attempts > 8)
    return json({ error: "Too many attempts. Try again in 15 minutes." }, 429, {
      "Retry-After": "900",
    });
  const credential = JSON.parse(env.AUTH_CREDENTIAL);
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(body.password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(credential.salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      base,
      256,
    ),
  );
  let different = derived.length ^ credential.hash.length;
  for (let i = 0; i < derived.length; i++)
    different |= derived.charCodeAt(i) ^ credential.hash.charCodeAt(i);
  if (different)
    return json({ error: "That password was not recognised." }, 401);
  const token = random(),
    csrf = random();
  await env.DB.prepare("INSERT INTO sessions VALUES (?,?,?,?)")
    .bind(await hash(token), csrf, now + 8 * 3600000, now)
    .run();
  return json({ csrf }, 200, { "Set-Cookie": cookie(token, 8 * 3600) });
}
async function session(req, env) {
  const token = req.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)__Host-cctv=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  const key = await hash(token);
  const s = await env.DB.prepare(
    "SELECT * FROM sessions WHERE token_hash=? AND expires>? AND last_seen>?",
  )
    .bind(key, Date.now(), Date.now() - 30 * 60000)
    .first();
  if (s)
    await env.DB.prepare("UPDATE sessions SET last_seen=? WHERE token_hash=?")
      .bind(Date.now(), key)
      .run();
  return s;
}
const audit = (env, action, id) =>
  env.DB.prepare("INSERT INTO audit(action,camera_id,at) VALUES (?,?,?)").bind(
    action,
    id,
    Date.now(),
  );
async function externalLimit(env, service, windowMs) {
  const now = Date.now(),
    key = service + "-" + Math.floor(now / windowMs);
  const row = await env.DB.prepare(
    "INSERT INTO login_limits(key,attempts,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
  )
    .bind(key, now + windowMs)
    .first();
  return row.attempts <= 1;
}
export async function places(req) {
  const b = await payload(req, 2048);
  if (
    b.externalConsent !== true ||
    !Number.isFinite(b.lat) ||
    !Number.isFinite(b.lng) ||
    b.lat < 49 ||
    b.lat > 61 ||
    b.lng < -9 ||
    b.lng > 3
  )
    throw new Error(
      "Confirm a valid test location for the external business lookup.",
    );
  const query = `[out:json][timeout:12];(nwr(around:150,${b.lat.toFixed(6)},${b.lng.toFixed(6)})[shop][name];nwr(around:150,${b.lat.toFixed(6)},${b.lng.toFixed(6)})[amenity~"^(restaurant|cafe|pub|bar|fuel|bank)$"][name];);out center tags 30;`;
  let res;
  try {
    res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": "CCTV-Enquiries-Test/2.0",
      },
      signal: AbortSignal.timeout(18000),
    });
  } catch {
    return json(
      {
        error:
          "The business lookup timed out or could not connect. Try again later or enter the site details manually.",
      },
      503,
    );
  }
  if (!res.ok)
    return json(
      {
        error: `Public business lookup is temporarily unavailable (provider HTTP ${res.status}). Try again later or enter the site details manually.`,
      },
      503,
    );
  let data;
  try {
    data = await res.json();
  } catch {
    return json(
      {
        error:
          "The business service returned an unreadable response. Please enter the site details manually.",
      },
      503,
    );
  }
  if (!data || data.remark || !Array.isArray(data.elements))
    return json(
      {
        error:
          "The business service could not complete this lookup. Try again later or enter the site details manually.",
      },
      503,
    );
  return json({
    places: data.elements
      .filter(
        (e) =>
          e &&
          typeof e.tags?.name === "string" &&
          ["node", "way", "relation"].includes(e.type) &&
          Number.isSafeInteger(e.id),
      )
      .slice(0, 30)
      .map((e) => ({
        name: e.tags.name,
        address: [
          e.tags["addr:housenumber"],
          e.tags["addr:street"],
          e.tags["addr:city"],
          e.tags["addr:postcode"],
        ]
          .filter(Boolean)
          .join(" "),
        publicPhone: e.tags["contact:phone"] || e.tags.phone || "",
        contactSource: e.tags["contact:website"] || e.tags.website || "",
        placeSource: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      })),
  });
}
async function route(req) {
  const b = await payload(req, 4096);
  if (b.externalConsent !== true)
    return json(
      { error: "Confirm use of the external test routing service." },
      400,
    );
  if (!Array.isArray(b.points) || b.points.length < 2 || b.points.length > 12)
    return json({ error: "Choose between two and twelve route points." }, 400);
  for (const p of b.points)
    if (
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lng) ||
      p.lat < 49 ||
      p.lat > 61 ||
      p.lng < -9 ||
      p.lng > 3
    )
      return json({ error: "Choose valid UK coordinates." }, 400);
  const coords = b.points
    .map((p) => p.lng.toFixed(6) + "," + p.lat.toFixed(6))
    .join(";");
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`,
    {
      headers: { "User-Agent": "CCTV-Enquiries-Test/2.0" },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok)
    throw new Error(
      "Road routing is unavailable. Trace the route manually or try again.",
    );
  const data = await res.json();
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r?.geometry?.coordinates?.length)
    throw new Error("No road route was found. Trace the route manually.");
  return json({
    points: r.geometry.coordinates.map((c) => ({ lat: c[1], lng: c[0] })),
    distance: r.distance,
    duration: r.duration,
  });
}
export default {
  async fetch(req, env) {
    try {
      const u = new URL(req.url),
        path = u.pathname;
      if (path === "/robots.txt")
        return new Response("User-agent: *\nDisallow: /", {
          headers: security,
        });
      if (!path.startsWith("/api/")) {
        if (req.method !== "GET" && req.method !== "HEAD")
          return json({ error: "Method not allowed." }, 405);
        const asset = env.ASSETS
          ? await env.ASSETS.fetch(req)
          : new Response("Build the application first.", { status: 503 });
        const headers = new Headers(asset.headers);
        for (const [k, v] of Object.entries(security)) headers.set(k, v);
        headers.set(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        );
        return new Response(asset.body, { status: asset.status, headers });
      }
      if (!["GET", "POST", "PUT", "DELETE"].includes(req.method))
        return json({ error: "Method not allowed." }, 405);
      if (req.method !== "GET" && !sameOrigin(req))
        return json({ error: "Request origin not allowed." }, 403);
      if (path === "/api/login" && req.method === "POST")
        return await login(req, env);
      const s = await session(req, env);
      if (!s)
        return json({ error: "Your session has ended. Sign in again." }, 401, {
          "Set-Cookie": cookie("", 0),
        });
      if (req.method !== "GET" && req.headers.get("X-CSRF-Token") !== s.csrf)
        return json({ error: "Refresh the page and try again." }, 403);
      if (path === "/api/session" && req.method === "GET")
        return json({
          csrf: s.csrf,
          mode: "test",
          mapProvider: "OpenStreetMap",
          routeProvider: "OSRM demo",
        });
      if (path === "/api/logout" && req.method === "POST") {
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
          .bind(s.token_hash)
          .run();
        return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
      }
      if (path === "/api/route" && req.method === "POST") {
        if (!(await externalLimit(env, "route", 1000)))
          return json(
            { error: "Please wait a second before requesting another route." },
            429,
          );
        return await route(req);
      }
      if (path === "/api/places" && req.method === "POST") {
        if (!(await externalLimit(env, "places", 10000)))
          return json(
            {
              error: "Please wait ten seconds before another business lookup.",
            },
            429,
          );
        return await places(req);
      }
      if (path === "/api/cameras" && req.method === "GET") {
        const result = await env.DB.prepare(
          "SELECT data FROM cameras ORDER BY id",
        ).all();
        return json({ cameras: result.results.map((r) => JSON.parse(r.data)) });
      }
      const match = path.match(
        /^\/api\/cameras\/([a-zA-Z0-9_-]{1,64})(\/photo)?$/,
      );
      if (match?.[2] && req.method === "GET") {
        const photo = await env.DB.prepare(
          "SELECT jpeg FROM photos WHERE camera_id=?",
        )
          .bind(match[1])
          .first();
        if (!photo) return json({ error: "Photo not found." }, 404);
        return new Response(new Uint8Array(photo.jpeg), {
          headers: {
            ...security,
            "Content-Type": "image/jpeg",
            "Content-Disposition": 'inline; filename="camera-reference.jpg"',
          },
        });
      }
      if (
        (path === "/api/cameras" && req.method === "POST") ||
        (match && !match[2] && req.method === "PUT")
      ) {
        const body = await payload(req);
        const data = validateCamera(body);
        let old = null;
        if (match) {
          const row = await env.DB.prepare(
            "SELECT data,revision FROM cameras WHERE id=?",
          )
            .bind(match[1])
            .first();
          if (!row) return json({ error: "Camera not found." }, 404);
          old = JSON.parse(row.data);
          if (body.revision !== row.revision)
            return json(
              { error: "This camera has changed. Refresh before editing." },
              409,
            );
        }
        const now = new Date().toISOString();
        const id = old?.id || crypto.randomUUID();
        const revision = (old?.revision || 0) + 1;
        const record = {
          ...data,
          id,
          revision,
          createdAt: old?.createdAt || now,
          updatedAt: now,
          verifiedAt: now,
          hasPhoto: body.photo
            ? true
            : body.removePhoto
              ? false
              : old?.hasPhoto || false,
          source: old?.source || "Field observation (test)",
        };
        const statements = [];
        if (old)
          statements.push(
            env.DB.prepare(
              "UPDATE cameras SET data=?,revision=? WHERE id=? AND revision=?",
            ).bind(JSON.stringify(record), revision, id, body.revision),
          );
        else
          statements.push(
            env.DB.prepare(
              "INSERT INTO cameras(id,data,revision) VALUES (?,?,?)",
            ).bind(id, JSON.stringify(record), revision),
          );
        // This entire batch is atomic. The revision guard below aborts a concurrent update.
        if (old)
          statements.push(
            env.DB.prepare(
              "SELECT CASE WHEN changes()=0 THEN json('conflict') ELSE 1 END",
            ),
          );
        if (body.photo) {
          const bytes = sanitiseJPEG(
            Uint8Array.from(atob(body.photo.split(",")[1]), (c) =>
              c.charCodeAt(0),
            ),
          );
          statements.push(
            env.DB.prepare(
              "INSERT INTO photos(camera_id,jpeg) VALUES (?,?) ON CONFLICT(camera_id) DO UPDATE SET jpeg=excluded.jpeg",
            ).bind(id, bytes.buffer),
          );
        } else if (body.removePhoto)
          statements.push(
            env.DB.prepare("DELETE FROM photos WHERE camera_id=?").bind(id),
          );
        statements.push(audit(env, old ? "update" : "create", id));
        await env.DB.batch(statements);
        return json({ camera: record }, old ? 200 : 201);
      }
      if (match && !match[2] && req.method === "DELETE") {
        const b = await payload(req, 2048);
        if (!Number.isInteger(b.revision))
          return json({ error: "Camera revision required." }, 400);
        const row = await env.DB.prepare(
          "SELECT revision FROM cameras WHERE id=?",
        )
          .bind(match[1])
          .first();
        if (!row) return json({ error: "Camera not found." }, 404);
        if (row.revision !== b.revision)
          return json(
            { error: "This camera has changed. Refresh before deleting." },
            409,
          );
        await env.DB.batch([
          env.DB.prepare("DELETE FROM cameras WHERE id=? AND revision=?").bind(
            match[1],
            b.revision,
          ),
          env.DB.prepare(
            "SELECT CASE WHEN changes()=0 THEN json('conflict') ELSE 1 END",
          ),
          env.DB.prepare("DELETE FROM photos WHERE camera_id=?").bind(match[1]),
          audit(env, "delete", match[1]),
        ]);
        return json({ ok: true });
      }
      return json({ error: "Not found." }, 404);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Request failed.";
      if (/D1|SQLITE|database|malformed JSON/.test(message))
        return json(
          { error: "Unable to save. Refresh the camera list and try again." },
          409,
        );
      return json({ error: message.slice(0, 240) }, 400);
    }
  },
  async scheduled(event, env) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM sessions WHERE expires<? OR last_seen<?",
      ).bind(now, now - 30 * 60000),
      env.DB.prepare("DELETE FROM login_limits WHERE expires<?").bind(now),
      env.DB.prepare("DELETE FROM audit WHERE at<?").bind(now - 14 * 86400000),
    ]);
  },
};
