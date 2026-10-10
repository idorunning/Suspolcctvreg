import assert from "node:assert/strict";
import fs from "node:fs";

// Separate from routine tests: sends this location to overpass-api.de through
// the live Worker. Obtain specific destination authorisation first.
const [consent, latitude, longitude] = process.argv.slice(2);
const lat = Number(latitude),
  lng = Number(longitude);
if (
  consent !== "--authorised-overpass" ||
  !latitude ||
  !longitude ||
  !Number.isFinite(lat) ||
  !Number.isFinite(lng) ||
  lat < 49 ||
  lat > 61 ||
  lng < -9 ||
  lng > 3
) {
  throw new Error(
    "With authorisation to share this location, run: node scripts/check-business-lookup.mjs --authorised-overpass LAT LNG",
  );
}
const base = "https://suspol-cctv-test.ntracey.workers.dev";
const access = JSON.parse(fs.readFileSync("private/access.json", "utf8"));
const login = await fetch(base + "/api/login", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ password: access.password }),
  signal: AbortSignal.timeout(30000),
});
assert.equal(login.status, 200, "Test login must succeed");
const cookie = login.headers.get("set-cookie").split(";")[0];
const { csrf } = await login.json();
const headers = {
  Origin: base,
  "Content-Type": "application/json",
  Cookie: cookie,
  "X-CSRF-Token": csrf,
};
try {
  const started = Date.now();
  const response = await fetch(base + "/api/places", {
    method: "POST",
    headers,
    body: JSON.stringify({ lat, lng, externalConsent: true }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  const result = {
    checkedAt: new Date().toISOString(),
    status: response.status,
    elapsedMs: Date.now() - started,
    count: data.places?.length,
    error: data.error,
    withAddress: data.places?.filter((p) => p.address).length,
    withPhone: data.places?.filter((p) => p.publicPhone).length,
    withSource: data.places?.filter((p) =>
      /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(
        p.placeSource,
      ),
    ).length,
  };
  // Retain counts only, never listings, coordinates, cookies or credentials.
  fs.writeFileSync(
    "private/business-lookup-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  assert.equal(response.status, 200, "Business lookup must succeed");
  assert.ok(Array.isArray(data.places));
  assert.ok(data.places.length <= 30);
  assert.equal(result.withSource, result.count);
} finally {
  const logout = await fetch(base + "/api/logout", {
    method: "POST",
    headers,
    body: "{}",
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(logout.status, 200, "Test session must be revoked");
}
