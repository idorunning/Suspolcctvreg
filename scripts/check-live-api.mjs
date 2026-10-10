import assert from "node:assert/strict";
import fs from "node:fs";
const base = "https://suspol-cctv-test.ntracey.workers.dev",
  access = JSON.parse(fs.readFileSync("private/admin-access.json", "utf8"));
const results = [];
let token = "",
  csrf = "",
  created = "";
async function req(path, method = "GET", body, headers = {}) {
  return fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(token ? { Cookie: token } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
const result = (name) => results.push({ test: name, result: "pass" });
try {
  let r = await req("/cameras");
  assert.equal(r.status, 401);
  result("Unauthenticated camera access rejected");
  r = await req("/cameras/test-001/photo");
  assert.equal(r.status, 401);
  result("Unauthenticated photo access rejected");
  r = await req(
    "/login",
    "POST",
    { username: access.username, password: access.password },
    { Origin: "https://example.invalid" },
  );
  assert.equal(r.status, 403);
  result("Cross-origin login rejected");
  r = await req("/login", "POST", { username: access.username, password: access.password });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie");
  assert.ok(
    cookie.includes("HttpOnly") &&
      cookie.includes("Secure") &&
      cookie.includes("SameSite=Strict"),
  );
  token = cookie.split(";")[0];
  csrf = (await r.json()).csrf;
  result("Password login and protected session cookie");
  r = await req("/cameras");
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("cache-control").includes("no-store"));
  const list = (await r.json()).cameras;
  assert.equal(list.filter((c) => c.id.startsWith("test-")).length, 58);
  assert.ok(!JSON.stringify(list).includes("@"));
  result("58 sanitised records behind authentication");
  const b = {
    kind: "business",
    name: "TEST QA — remove after verification",
    address: "",
    lat: 50.8135,
    lng: -0.3705,
    direction: 0,
    fieldOfView: 90,
    viewDistance: 30,
    publicFacingConfirmed: true,
  };
  r = await req("/cameras", "POST", b, { "X-CSRF-Token": "" });
  assert.equal(r.status, 403);
  result("CSRF enforced on writes");
  r = await req("/cameras", "POST", {
    ...b,
    creatorEmail: "should-not-store@example.org",
  });
  assert.equal(r.status, 400);
  result("Personal and unknown fields rejected by server");
  const img = fs.readFileSync("private/test-photo.jpg");
  r = await req("/cameras", "POST", {
    ...b,
    photo: "data:image/jpeg;base64," + img.toString("base64"),
    photoConfirmed: true,
  });
  assert.equal(r.status, 201, await r.clone().text());
  const cam = (await r.json()).camera;
  created = cam.id;
  result("Quick-add record and reviewed photo persist");
  r = await req("/cameras/" + created + "/photo");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/jpeg");
  assert.ok((await r.arrayBuffer()).byteLength > 100);
  result("Authenticated photo retrieval");
  const updates = await Promise.all([
    req("/cameras/" + created, "PUT", {
      ...b,
      name: "TEST QA revision A",
      revision: 1,
    }),
    req("/cameras/" + created, "PUT", {
      ...b,
      name: "TEST QA revision B",
      revision: 1,
    }),
  ]);
  assert.deepEqual(updates.map((x) => x.status).sort(), [200, 409]);
  result("Concurrent updates cannot overwrite one another");
  results.push({
    test: "External route and business services",
    result:
      "not exercised by this script; requires destination-specific authorisation",
  });
  r = await req("/cameras/" + created, "DELETE", { revision: 2 });
  assert.equal(r.status, 200);
  created = "";
  result("Delete removes test record and photo");
  r = await req("/logout", "POST", {});
  assert.equal(r.status, 200);
  r = await req("/cameras");
  assert.equal(r.status, 401);
  result("Logout revokes server session");
} catch (e) {
  results.push({ test: "Failure", result: "FAIL", detail: e.message });
  process.exitCode = 1;
} finally {
  if (created) {
    await req("/cameras/" + created, "DELETE", { revision: 2 });
    await req("/cameras/" + created, "DELETE", { revision: 1 });
  }
  fs.writeFileSync(
    "private/api-test-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
}
