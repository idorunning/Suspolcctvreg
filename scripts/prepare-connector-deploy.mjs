import fs from "node:fs";
import path from "node:path";
const root = path.resolve("dist"),
  files = {};
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else {
      const rel = "/" + path.relative(root, p);
      files[rel] = {
        body: fs.readFileSync(p, "utf8"),
        type: rel.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : rel.endsWith(".css")
            ? "text/css; charset=utf-8"
            : rel.endsWith(".svg")
              ? "image/svg+xml"
              : rel.endsWith(".webmanifest")
                ? "application/manifest+json"
                : "text/html; charset=utf-8",
      };
    }
  }
}
walk(root);
const assets =
  "const assets=" +
  JSON.stringify(files) +
  ';export default {async fetch(request){const path=new URL(request.url).pathname;const file=assets[path==="/"?"/index.html":path];return file?new Response(request.method==="HEAD"?null:file.body,{headers:{"Content-Type":file.type}}):new Response("Not found",{status:404});}};';
const entry =
  'import app from "./index.mjs";import assets from "./assets.mjs";export default {fetch:(request,env,ctx)=>app.fetch(request,{...env,ASSETS:assets},ctx),scheduled:(event,env,ctx)=>app.scheduled(event,env,ctx)};';
const metadata = {
  main_module: "entry.mjs",
  compatibility_date: "2026-10-01",
  bindings: [
    { type: "d1", name: "DB", id: "80561528-ff48-4e92-b6f5-82f20ea547ed" },
  ],
  keep_bindings: ["secret_text"],
  observability: { enabled: false },
  logpush: false,
};
const modules = {
  "entry.mjs": entry,
  "index.mjs": fs.readFileSync("worker/index.mjs", "utf8"),
  "validation.mjs": fs.readFileSync("worker/validation.mjs", "utf8"),
  "assets.mjs": assets,
};
const boundary = "----CCTVBuild20261010";
const parts = [
  `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}`,
];
for (const [name, code] of Object.entries(modules))
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${name}"\r\nContent-Type: application/javascript+module\r\n\r\n${code}`,
  );
parts.push(`--${boundary}--`);
fs.mkdirSync("private", { recursive: true });
fs.writeFileSync(
  "private/deploy-payload.json",
  JSON.stringify({
    body: parts.join("\r\n"),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }),
);
console.log(
  "Prepared connector deployment. No camera data or secrets are in the asset bundle.",
);
