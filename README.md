# CCTV Enquiries — Sussex Camera Register

Responsive CCTV enquiry **test application**. This replaces the previous shared-file prototype with a Cloudflare Worker, a private D1 database and a responsive React/Leaflet interface.

**Test site:** https://suspol-cctv-test.ntracey.workers.dev/

This is not an accredited police system. Use public-facing camera test data only, never live investigation details. Read [the operational readiness and data review](docs/operational-readiness.md) before extending its use.

## What is implemented

- Camera markers cluster as the map zooms out, separate as it zooms in, and spread coincident markers at maximum zoom. Marker size adapts to zoom. Optional view cones are explicitly approximate.
- Desktop map/list workspace and mobile map, camera list, route and quick-add navigation.
- **Walking or driving** routes use separate FOSSGIS/OSRM graphs after explicit test-routing consent. Add up to ten intermediate sightings between A and B; edit, remove or reorder them. Anchors retain their chosen order. Route totals use miles, with short camera offsets/corridor widths in metres. Manual tracing sends no routing request.
- Raise the **Cameras in route order** header to expand the list; lower it to restore route controls. Supports click, keyboard and vertical swipe, including mobile.
- Formal pale-blue, dark-blue and white interface.
- CSV export with formula-injection protection and an email **draft** opened in the user's mail client. The app does not send email or store recipients.
- GPS or map-position quick add, structured public premises details, verified organisation phone numbers, asset references, camera view estimates and reported retention.
- Camera reference photos, canvas redaction, client resizing and JPEG re-encoding, server metadata stripping, authenticated later viewing and deletion.
- Optional OpenStreetMap/Overpass business suggestions with explicit coordinate-sharing notice and source attribution. **Automatic lookup remains unavailable from the deployed site:** authorised testing identified provider HTTP 521 from Cloudflare. A direct test returned 30 listings, but an isolated browser trial also failed. Manual entry is the working fallback. Provider errors and partial responses are explicitly reported, never treated as an empty successful search.
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

After applying both migrations, run `node scripts/provision-owner.mjs` once and execute the parameterised insert in ignored `private/owner-query.json` against the intended database. It creates the initial `nathan` web master and saves random credentials in ignored `private/admin-access.json`; do not commit or overwrite either file.

`create-test-access.mjs` writes a randomly generated password and credential hash into ignored `private/access.json` and `.dev.vars`, not into client code. Open the local Worker URL printed by Wrangler. For live frontend editing, run `npm run dev` in a second terminal; Vite proxies `/api` to the local Worker. GPS/camera support depends on a secure context and device permissions. Localhost is suitable for desktop testing; use the HTTPS test site on a phone.

Optional local seed: `npx wrangler d1 execute suspol-cctv-test --local --file=private/seed.sql`.

## Deploy / maintain

`wrangler.jsonc` describes the Worker, D1 binding and 15-minute housekeeping schedule. Authenticate Wrangler against the authorised Cloudflare account, apply migrations with `--remote`, then use `npm run deploy`. Set `AUTH_CREDENTIAL` and `RATE_SECRET` with `wrangler secret put`; never use a `VITE_` variable for secrets. `AUTH_CREDENTIAL` is JSON with a random hex salt and a PBKDF2-SHA256 hash (100,000 iterations, 32 bytes); see the local helper.

The current deployment was uploaded through the Cloudflare connector as ES modules with the built public assets embedded in a separate module. The Worker serves these through the same application handler, security headers and API code. `scripts/prepare-connector-deploy.mjs` prepares the upload payload locally. Camera seed data and credentials are never bundled. GitHub auto-deployment is **not configured**: a later source commit needs a deliberate deployment or an approved CI setup.

Account passwords are changed under Account → My account; changes and recovery revoke all sessions for that account and rotate its single-use recovery code. Removing an account or changing its role revokes its sessions and pending invitations. `AUTH_CREDENTIAL` now provides dummy password work for unknown accounts only; it no longer grants shared access. Deployments preserve secrets and data. Use a separate database for any future operational environment.

Housekeeping removes expired sessions, old login-throttle counters and audit events older than 14 days. Sessions expire after 30 minutes without an API request or eight hours maximum. The UI locks after approximately 29 minutes without pointer/keyboard interaction. Photo bytes are bounded JPEG BLOBs in a separate table for this small pilot; migrate to private, approved object storage if scale requires it.

## Validation

`npm run lint`, `npm test`, `npm run build` and `npm audit` pass. Sixteen automated tests cover content validation, metadata removal, route corridor ordering, CSV injection, business-lookup consent, response mapping and upstream failures. Live API tests covered login, unauthorised reads, CSRF, personal/unknown field rejection, photo persistence, concurrent updates, deletion, logout and real road geometry. The temporary QA record and photo were removed. Desktop clustering, route candidate lists and mobile quick add were checked in the browser using an isolated synthetic fixture; it had no connection to the real test database. Phone GPS and physical camera capture still need a check on a real managed device.

An opt-in external diagnostic is available as `node scripts/check-business-lookup.mjs --authorised-overpass LAT LNG`. It sends the supplied coordinates to Overpass through the live Worker, so obtain destination-specific authorisation before running it. It stores only response counts/status in an ignored local file and revokes its test session afterwards. Routine tests never contact Overpass.

Public map/routing services have no service guarantee. Account aliases are not force-verified identities; MFA and independently protected audit storage remain outstanding. Code checks cannot prove that arbitrary text or an image contains no personal data. See the documented operational blockers.

## Accounts, invitations and route controls

- Clear route removes the line, waypoints and results and invalidates pending routing responses. New route also starts point selection. Both work for road routes and manual traces.
- All camera POVs are on by default. The labelled map toggle hides or shows every displayed camera’s estimated cone at any zoom; geometry stays anchored to the camera and scales with the map. Cones use saved direction, viewing angle and range, and cannot account for obstructions or confirm footage.
- Camera POV opens the selected camera at close zoom and shows its estimated view cone. It is not a live feed or Google Street View. Direction, field of view, distance and reference photographs remain available.
- **User:** read maps and camera details, export, map routes, add cameras, verify cameras, change own password and recover with a saved recovery code.
- **Supervisor:** all User permissions, edit cameras/details and issue User invitations. No account removal, role promotion, bulk changes or log access.
- **Web master:** all permissions, invite any role, change other accounts' roles, remove access, inspect the application event log and apply atomic bulk verification, verification removal, reported-retention updates or deletion to up to 50 cameras.
- Invitations are hashed, expire in 24 hours, can be revoked and are consumed atomically once. Email invitation opens the approved mail application; the website does not automatically send email or store recipients' email addresses. Automatic sending requires an agreed, verified sender domain and provider configuration.
- Access-control and session checks happen on the server, not just hidden buttons. The legacy shared password no longer signs in. Initial account credentials are delivered privately to the project owner.
- Account aliases and opaque IDs are security metadata and can be personal data. They are separate from the camera-content schema, not exempt from governance. Removed accounts retain an opaque ID for audit but their aliases and credential material are removed from active tables.
- Audit covers API requests/results and explicit application/account/camera actions. CSV exports and email-draft creation require a recorded event first. Manual-route and POV events are best-effort browser events; browser activity, disconnected actions, static assets and hosting infrastructure are not comprehensively logged. Logs expire after 14 days and are not immutable. No passwords, invite tokens, email recipients or investigation route coordinates are written to this log.
