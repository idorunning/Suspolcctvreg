# CCTV Enquiries — Sussex Camera Register

Responsive CCTV enquiry **test application**. This replaces the previous shared-file prototype with a Cloudflare Worker, a private D1 database and a responsive React/Leaflet interface.

**Test site:** https://suspol-cctv-test.ntracey.workers.dev/

This is not an accredited police system. Use public-facing camera test data only, never live investigation details. Read [the operational readiness and data review](docs/operational-readiness.md) before extending its use.

## What is implemented

- Camera markers cluster as the map zooms out, separate as it zooms in, and spread coincident markers at maximum zoom. Marker size adapts to zoom. Optional view cones are explicitly approximate.
- Desktop map/list workspace and mobile map, camera list, route and quick-add navigation.
- A-to-B indicative **driving** routes through an explicitly enabled OSRM test service. Manually trace a walking/observed route without calling a routing provider. Select a 25/50/100/200-metre corridor; camera candidates appear in travel order.
- CSV export with formula-injection protection and an email **draft** opened in the user's mail client. The app does not send email or store recipients.
- GPS or map-position quick add, structured public premises details, verified organisation phone numbers, asset references, camera view estimates and reported retention.
- Camera reference photos, canvas redaction, client resizing and JPEG re-encoding, server metadata stripping, authenticated later viewing and deletion.
- Optional OpenStreetMap/Overpass business suggestions with explicit coordinate-sharing notice and source attribution. Manual entry remains available. The external lookup was unavailable in live API testing; further testing was blocked by automatic approval review pending specific authorisation to transmit camera coordinates to Overpass. It is not a verified integration.
- Server-enforced password login, secure HTTP-only sessions, CSRF/origin checks, login throttling, optimistic concurrency, strict field allow-list, private/no-store API responses, CSP and disabled Worker application logs.
- No personal contact fields, footage uploads, ANPR or residential camera category; no localStorage or IndexedDB camera database. No tracking/analytics scripts or service-worker cache.

## Test import

71 source rows were reviewed: **58 imported, 13 held out**. Officer emails, creator identifiers, original IDs, timestamps and the ambiguous existing reference were omitted. The original attachment was not modified. All imported entries remain **unverified**; all addresses were absent in the source. Camera coordinates are not evidence of current operation or coverage. Raw and sanitised seed files are intentionally **not committed to this public repository**.

Run the private import preparation only with an authorised input file:

```sh
python scripts/import-test-data.py /private/path/input.csv private
```

## Local development

Node 22+ is recommended. Install dependencies, build, initialise a local database and set local test secrets:

```sh
npm ci
npm run build
npx wrangler d1 migrations apply suspol-cctv-test --local
node scripts/create-test-access.mjs
npm run worker
```

`create-test-access.mjs` writes a randomly generated password and credential hash into ignored `private/access.json` and `.dev.vars`, not into client code. Open the local Worker URL printed by Wrangler. For live frontend editing, run `npm run dev` in a second terminal; Vite proxies `/api` to the local Worker. GPS/camera support depends on a secure context and device permissions. Localhost is suitable for desktop testing; use the HTTPS test site on a phone.

Optional local seed: `npx wrangler d1 execute suspol-cctv-test --local --file=private/seed.sql`.

## Deploy / maintain

`wrangler.jsonc` describes the Worker, D1 binding and 15-minute housekeeping schedule. Authenticate Wrangler against the authorised Cloudflare account, apply migrations with `--remote`, then use `npm run deploy`. Set `AUTH_CREDENTIAL` and `RATE_SECRET` with `wrangler secret put`; never use a `VITE_` variable for secrets. `AUTH_CREDENTIAL` is JSON with a random hex salt and a PBKDF2-SHA256 hash (100,000 iterations, 32 bytes); see the local helper.

The current deployment was uploaded through the Cloudflare connector as ES modules with the built public assets embedded in a separate module. The Worker serves these through the same application handler, security headers and API code. `scripts/prepare-connector-deploy.mjs` prepares the upload payload locally. Camera seed data and credentials are never bundled. GitHub auto-deployment is **not configured**: a later source commit needs a deliberate deployment or an approved CI setup.

Password rotation: replace `AUTH_CREDENTIAL`, then delete existing `sessions` through an authorised database maintenance operation. Changing the password alone does not revoke already-issued sessions. Deployments preserve secrets and data. Use a separate database for any future operational environment.

Housekeeping removes expired sessions, old login-throttle counters and audit events older than 14 days. Sessions expire after 30 minutes without an API request or eight hours maximum. The UI locks after approximately 29 minutes without pointer/keyboard interaction. Photo bytes are bounded JPEG BLOBs in a separate table for this small pilot; migrate to private, approved object storage if scale requires it.

## Validation

`npm run lint`, `npm test`, `npm run build` and `npm audit` pass. Eight unit tests cover content validation, metadata removal, route corridor ordering and CSV injection. Live API tests covered login, unauthorised reads, CSRF, personal/unknown field rejection, photo persistence, concurrent updates, deletion, logout and real road geometry. The temporary QA record and photo were removed. Desktop clustering, route candidate lists and mobile quick add were checked in the browser using an isolated synthetic fixture; it had no connection to the real test database. Phone GPS and physical camera capture still need a check on a real managed device.

Public map/routing services have no service guarantee. A shared password has no individual accountability. Code checks cannot prove that arbitrary text or an image contains no personal data. See the documented operational blockers.
