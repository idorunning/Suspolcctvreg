import test from "node:test";
import assert from "node:assert/strict";
import { places } from "../worker/index.mjs";

const request = (extra = {}) =>
  new Request("https://example.test/api/places", {
    method: "POST",
    body: JSON.stringify({
      lat: 50.8,
      lng: -0.4,
      externalConsent: true,
      ...extra,
    }),
  });

test("business lookup never contacts the provider without consent or with invalid coordinates", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Must not contact the provider");
  });
  for (const extra of [
    { externalConsent: false },
    { lat: null },
    { lat: 0 },
    { lng: 99 },
  ]) {
    await assert.rejects(
      places(request(extra)),
      /Confirm a valid test location/,
    );
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("business suggestions retain attribution and only map the permitted fields", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      elements: [
        {
          type: "node",
          id: 42,
          tags: {
            name: "Test shop",
            "addr:housenumber": "10",
            "addr:street": "High Street",
            "addr:city": "Test town",
            "contact:phone": "01903 123456",
            "contact:website": "https://example.org",
            email: "do-not-copy@example.org",
            operator: "do not copy",
          },
        },
        { type: "way", id: 43, tags: { name: "Test cafe" } },
        { type: "way", id: 44 },
        null,
      ],
    }),
  );
  const response = await places(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.deepEqual((await response.json()).places, [
    {
      name: "Test shop",
      address: "10 High Street Test town",
      publicPhone: "01903 123456",
      contactSource: "https://example.org",
      placeSource: "https://www.openstreetmap.org/node/42",
    },
    {
      name: "Test cafe",
      address: "",
      publicPhone: "",
      contactSource: "",
      placeSource: "https://www.openstreetmap.org/way/43",
    },
  ]);
});

test("provider failures and partial responses never appear as a successful empty lookup", async (t) => {
  const cases = [
    () => new Response("private provider detail", { status: 521 }),
    () => new Response("not JSON"),
    () =>
      Response.json({
        remark: "Query timed out with private detail",
        elements: [],
      }),
    () => Response.json({}),
    () => Response.json(null),
    () => {
      throw new Error("private connection detail");
    },
  ];
  for (const result of cases) {
    t.mock.method(globalThis, "fetch", async () => result());
    const response = await places(request());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.places, undefined);
    assert.match(body.error, /manually/);
    assert.ok(!JSON.stringify(body).includes("private"));
    t.mock.restoreAll();
  }
});
