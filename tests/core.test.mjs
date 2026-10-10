import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { validateCamera, sanitiseJPEG } from "../worker/validation.mjs";
const compiled = ts.transpileModule(
  fs.readFileSync(new URL("../src/domain.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const { alongRoute, routeMatches, cameraCSV } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const basic = {
  kind: "business",
  name: "Test supermarket",
  address: "10 High Street, Worthing",
  lat: 50.81,
  lng: -0.37,
  publicFacingConfirmed: true,
};
test("allow public premises addresses and ordinary business names", () => {
  assert.equal(
    validateCamera({ ...basic, name: "Toni & Guy" }).name,
    "Toni & Guy",
  );
  assert.equal(validateCamera(basic).address, basic.address);
});
test("reject unauthorised types, extra personal fields and explicit private cameras", () => {
  for (const b of [
    { ...basic, kind: "anpr" },
    { ...basic, kind: "doorbell" },
    { ...basic, creatorEmail: "test@example.org" },
    { ...basic, name: "Residential Ring camera" },
    { ...basic, address: "victim@example.org" },
    { ...basic, publicFacingConfirmed: false },
  ])
    assert.throws(() => validateCamera(b));
});
test("allow verified organisation numbers; reject personal mobile numbers and unverified sources", () => {
  assert.equal(
    validateCamera({
      ...basic,
      publicPhone: "01903 123456",
      contactSource: "https://example.org/contact",
      contactConfirmed: true,
    }).publicPhone,
    "01903123456",
  );
  for (const v of [
    {
      publicPhone: "07700 900123",
      contactConfirmed: true,
      contactSource: "https://example.org",
    },
    {
      publicPhone: "01903 123456",
      contactConfirmed: false,
      contactSource: "https://example.org",
    },
    { publicPhone: "01903 123456", contactConfirmed: true },
    { contactSource: "javascript:alert(1)" },
    { contactSource: "https://example.org?name=person" },
  ])
    assert.throws(() => validateCamera({ ...basic, ...v }));
});
test("reject non-finite/out-of-bounds geometry and unsupported retention", () => {
  for (const p of [
    { lat: 0 },
    { lng: Infinity },
    { direction: 360 },
    { fieldOfView: 0 },
    { viewDistance: 10000 },
    { retentionDays: 365 },
  ])
    assert.throws(() => validateCamera({ ...basic, ...p }));
});
test("photos need review and JPEG limits are enforced", () => {
  assert.throws(() =>
    validateCamera({
      ...basic,
      photo: "data:image/jpeg;base64,AAAA",
      photoConfirmed: false,
    }),
  );
  assert.throws(() => sanitiseJPEG(new Uint8Array([1, 2, 3])));
});
test("server strips JPEG APP metadata and rejects huge dimensions", () => {
  const fixture = new Uint8Array([
    255, 216, 255, 225, 0, 6, 69, 88, 73, 70, 255, 192, 0, 8, 8, 0, 20, 0, 20,
    1, 255, 218, 0, 2, 1, 2, 255, 217,
  ]);
  const clean = sanitiseJPEG(fixture);
  assert.equal(Buffer.from(clean).includes(Buffer.from("EXIF")), false);
  const huge = fixture.slice();
  huge[15] = 8;
  assert.throws(() => sanitiseJPEG(huge));
});
test("route corridor uses segments, respects threshold and returns travel order", () => {
  const route = [
    { lat: 50, lng: -0.4 },
    { lat: 50, lng: -0.39 },
    { lat: 50, lng: -0.38 },
  ];
  const cameras = [
    { id: "end", lat: 50, lng: -0.381 },
    { id: "start", lat: 50.0002, lng: -0.399 },
    { id: "outside", lat: 50.003, lng: -0.39 },
  ];
  const matches = routeMatches(cameras, route, 50);
  assert.deepEqual(
    matches.map((x) => x.camera.id),
    ["start", "end"],
  );
  assert.ok(matches[0].distance > 21 && matches[0].distance < 23);
  assert.equal(routeMatches(cameras, [], 50).length, 0);
  assert.ok(
    alongRoute(cameras[0], [route[0], route[0], route[2]]).distance < 1,
  );
});
test("CSV blocks formula injection and preserves quoted names", () => {
  const csv = cameraCSV([
    {
      ...basic,
      id: "id",
      kind: "business",
      name: '=HYPERLINK("x")',
      publicPhone: "+441903123456",
      contactSource: "",
      assetReference: "TEST",
      direction: 0,
      fieldOfView: 90,
      viewDistance: 30,
      retentionDays: null,
      verifiedAt: null,
    },
  ]);
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"\'+441903123456"'));
  assert.ok(!csv.includes("Creator Email"));
});
