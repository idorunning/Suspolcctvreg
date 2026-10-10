// Isolated visual test fixture. No credentials, police data, or connection to the real database.
import fs from "node:fs";
const payload = JSON.parse(fs.readFileSync("private/deploy-payload.json"));
const cameras = Array.from({ length: 58 }, (_, i) => ({
  id: "fixture-" + i,
  kind: i % 4 === 0 ? "council" : "business",
  name:
    (i % 4 === 0 ? "Demonstration public camera " : "Demonstration shop ") +
    (i + 1),
  address: "Synthetic test record — no real camera asserted",
  assetReference: "",
  publicPhone: "",
  contactSource: "",
  placeSource: "",
  lat: 50.8105 + Math.floor(i / 10) * 0.0013,
  lng: -0.375 + (i % 10) * 0.001,
  direction: (i * 31) % 360,
  fieldOfView: 90,
  viewDistance: 30,
  retentionDays: null,
  verifiedAt: null,
  createdAt: "2026-10-10T00:00:00Z",
  updatedAt: "2026-10-10T00:00:00Z",
  source: "Synthetic visual-test fixture",
  hasPhoto: false,
  revision: 1,
}));
const code = `import assets from './assets.mjs';let cameras=${JSON.stringify(cameras)};export default {async fetch(req){const path=new URL(req.url).pathname;const json=x=>Response.json(x);if(path==='/mobile')return new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:0;background:#dce4ec;display:flex;justify-content:center"><iframe title="Mobile visual test" src="/" style="width:390px;height:844px;border:0"></iframe>',{headers:{'Content-Type':'text/html'}});if(path==='/api/session')return json({csrf:'synthetic-fixture'});if(path==='/api/cameras'&&req.method==='POST'){const b=await req.json();const camera={...b,id:'fixture-new',revision:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),verifiedAt:new Date().toISOString(),source:'Synthetic fixture',hasPhoto:false};cameras.push(camera);return json({camera});}if(path==='/api/cameras')return json({cameras});if(path==='/api/logout')return json({ok:true});if(path==='/api/route')return json({error:'Use manual tracing in this visual fixture.'});return assets.fetch(req);}};`;
const boundary = "----SyntheticVisualTest20261010";
const metadata = {
  main_module: "fixture.mjs",
  compatibility_date: "2026-10-01",
  observability: { enabled: false },
  bindings: [],
};
const assetMatch = payload.body.match(
  /Content-Disposition: form-data; name="assets.mjs"; filename="assets.mjs"\r\nContent-Type: application\/javascript\+module\r\n\r\n([\s\S]*?)\r\n--/,
);
if (!assetMatch) throw Error("Asset module missing");
const parts = [
  `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}`,
];
for (const [name, body] of Object.entries({
  "fixture.mjs": code,
  "assets.mjs": assetMatch[1],
}))
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${name}"\r\nContent-Type: application/javascript+module\r\n\r\n${body}`,
  );
parts.push(`--${boundary}--`);
fs.writeFileSync(
  "private/visual-payload.json",
  JSON.stringify({
    body: parts.join("\r\n"),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }),
);
console.log("Prepared synthetic visual fixture.");
