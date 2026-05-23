# Sussex Police CCTV Registry

A web app for Sussex Police to register and locate CCTV cameras, petrol-station
cameras, police/council cameras, and other surveillance assets across the
force's operational area. Operationally sensitive data (camera GPS, owner
names, police reference numbers, officer audit logs) is stored **on-premises**
with **zero external network dependencies** at runtime.

## Architecture

- **Frontend** — React 19 + Vite + Leaflet + Tailwind CSS. Served by Nginx,
  bundles its own Leaflet marker assets, talks only to same-origin paths.
- **Backend** — Node 20 + Express + TypeScript. Validates with Zod, issues
  JWTs, writes to Postgres, streams live updates to the client over
  Server-Sent Events.
- **Database** — Postgres 16 (immutable events table enforced by triggers).
- **Tiles** — TileServer-GL serving a local MBTiles file via Nginx at
  `/tiles/{z}/{x}/{y}.png`.
- **Authentication** — Direct bind against Sussex Police Active Directory via
  LDAPS. First successful login auto-creates a `users` row as
  `role='viewer', status='pending'`; an admin approves it from the Admin
  Panel. `ADMIN_BOOTSTRAP_EMAIL` is promoted to `admin`/`approved` on first
  login.

## Running on-premises

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Network reachability to the AD/LDAP server from the backend container
- An OSM MBTiles file covering the required area (see *Tile data* below)

### 1. Prepare environment variables

```sh
cp .env.example .env.local           # frontend (baked into the bundle)
cp server/.env.example server/.env   # backend runtime config
```

Set, at minimum, in `server/.env` (or the orchestrator's secret store):

- `JWT_SECRET` — a long random string
- `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_SEARCH_BASE`,
  `LDAP_SEARCH_FILTER`
- `ADMIN_BOOTSTRAP_EMAIL` — the police email of the first admin

Top-level `.env` (for `docker compose`):

```
POSTGRES_PASSWORD=...
JWT_SECRET=...
CORS_ORIGIN=http://localhost:8080
LDAP_URL=ldaps://ad.sussex.police.uk:636
LDAP_BIND_DN=CN=svc_cctvreg,...
LDAP_BIND_PASSWORD=...
LDAP_SEARCH_BASE=OU=Users,DC=sussex,DC=police,DC=uk
LDAP_SEARCH_FILTER=(|(mail={{email}})(userPrincipalName={{email}}))
ADMIN_BOOTSTRAP_EMAIL=nathan.tracey@sussex.police.uk
FRONTEND_PORT=8080
```

### 2. Tile data

Drop an MBTiles file and a TileServer-GL `config.json` / style under `./tiles/`
before starting the stack. Sussex is small enough that a UK extract is
adequate:

```sh
mkdir tiles
# Obtain uk.mbtiles from your cartography provider or generate via tilemaker
#   on a PBF downloaded inside the secure perimeter.
cp uk.mbtiles tiles/
```

A minimal `tiles/config.json` that exposes the tiles at `/styles/basic-preview/`
(matching the Nginx upstream) comes with `tileserver-gl` defaults.

### 3. Boot the stack

```sh
docker compose up -d --build
```

On first boot the backend container runs `npm run migrate`, which creates the
`users`, `cameras`, and `events` tables and installs the append-only trigger
on `events`. The app is then available at `http://HOST:${FRONTEND_PORT:-8080}`.

### 4. First login

Log in as the `ADMIN_BOOTSTRAP_EMAIL` user (with their AD password). The row
is promoted to `admin`/`approved` automatically. Any other AD user who logs
in will land in `status='pending'` — approve them from **Admin Panel →
Users**.

## Local development

Frontend:

```sh
npm install
cp node_modules/leaflet/dist/images/marker-icon.png   public/leaflet/
cp node_modules/leaflet/dist/images/marker-icon-2x.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-shadow.png  public/leaflet/
npm run dev        # http://localhost:3000
```

Backend:

```sh
cd server
npm install
npm run migrate
npm run dev        # http://localhost:4000
```

Point the frontend at the dev backend with `VITE_API_BASE_URL=http://localhost:4000/api`
in `.env.local` (or run both behind the same nginx using `docker compose`).

## Network isolation check

Open the app in DevTools → Network and confirm all requests are same-origin:
there should be **no** calls to `*.googleapis.com`, `*.firebaseio.com`,
`nominatim.openstreetmap.org`, `tile.openstreetmap.org`, or
`cdnjs.cloudflare.com`. The Nginx CSP (`connect-src 'self'`) blocks any such
requests at the browser layer as a defence-in-depth measure.

## RBAC

Roles, enforced on every request by `requireRole` middleware:

| Role    | Read | Create | Edit/delete own | Edit/delete any | Admin panel |
|---------|:----:|:------:|:---------------:|:---------------:|:-----------:|
| viewer  |  ✓   |        |                 |                 |             |
| user    |  ✓   |   ✓    |        ✓        |                 |             |
| admin   |  ✓   |   ✓    |        ✓        |        ✓        |      ✓      |

Client-side checks gate the UI; the server is the source of truth.

## Live feeds

Cameras may carry an optional **Public Feed URL** (`publicOutputUrl`). The
**Live Feeds** dashboard lists every camera that has one and lets an operator
open the source feed in a new browser tab ("Open Feed") or jump to it on the
map ("Locate on Map").

Feeds are **not embedded inline**: most public webcam/traffic sites refuse to
be framed (`X-Frame-Options` / CSP `frame-ancestors`), so inline embedding is
unreliable, and embedding would also pull third-party content into the
air-gapped page. Link-out keeps the registry page same-origin (consistent with
the strict `connect-src 'self'` CSP in `nginx.conf`); whether the source feed
is reachable is governed by the host network's egress policy, not the app.

Only public, non-sensitive feed URLs should be recorded. The URL must be an
`http(s)` link; this is validated on both the client and the server.

## Audit logging

Every mutating request appends a row to `events`. UPDATE and DELETE on that
table are rejected by a Postgres trigger, so the log cannot be rewritten
from the application.

Admins view the log in **Admin Panel → Event Logs**.
