import test from "node:test";
import assert from "node:assert/strict";
import { route } from "../worker/index.mjs";
const points = [
  { lat: 50.814, lng: -0.375 },
  { lat: 50.815, lng: -0.374 },
  { lat: 50.816, lng: -0.373 },
];
const req = (extra = {}) =>
  new Request("https://example.test/api/route", {
    method: "POST",
    body: JSON.stringify({
      points,
      mode: "walking",
      externalConsent: true,
      ...extra,
    }),
  });
test("routing rejects missing consent, unsupported modes and invalid anchors before sending coordinates", async (t) => {
  const f = t.mock.method(globalThis, "fetch", () => {
    throw Error("Unexpected external request");
  });
  for (const extra of [
    { externalConsent: false },
    { mode: "cycling" },
    { points: [null, points[0]] },
    { points: [points[0]] },
    { points: Array(13).fill(points[0]) },
    { points: [points[0], { lat: 0, lng: 0 }] },
  ])
    assert.equal((await route(req(extra))).status, 400);
  assert.equal(f.mock.callCount(), 0);
});
test("walking and driving use distinct prepared graphs and preserve intermediate anchor order", async (t) => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(url);
    return Response.json({
      code: "Ok",
      routes: [
        {
          geometry: { coordinates: points.map((p) => [p.lng, p.lat]) },
          distance: 1609.344,
          duration: 1200,
        },
      ],
    });
  });
  for (const mode of ["walking", "driving"]) {
    const response = await route(req({ mode }));
    const data = await response.json();
    assert.deepEqual(data.points, points);
    assert.equal(data.distance, 1609.344);
  }
  assert.match(urls[0], /routed-foot\/route\/v1\/driving\//);
  assert.match(urls[1], /routed-car\/route\/v1\/driving\//);
  assert.ok(
    urls.every((url) =>
      url.includes(
        "-0.375000,50.814000;-0.374000,50.815000;-0.373000,50.816000",
      ),
    ),
  );
});
test("no walking route never silently falls back to driving or a straight line", async (t) => {
  const f = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ code: "NoRoute", routes: [] }),
  );
  await assert.rejects(route(req()), /No route was found/);
  assert.equal(f.mock.callCount(), 1);
});
