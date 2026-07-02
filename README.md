# Sussex CCTV Registry

A small-team camera registry for use on a shared SharePoint / OneDrive folder.
Created by **Nathan Tracey · Sussex Police · nathan.tracey@sussex.police.uk**.

The app is a **single self-contained HTML file**. You drop it in a SharePoint
folder and share that folder with a handful of trusted colleagues. There's no
separate sign-in — the folder's own SharePoint/OneDrive permissions (inside
the already-authenticated Sussex Police M365 tenant) are the access control,
much like a shared Excel workbook in a permissioned folder.

## What it does

- Map of cameras with markers, direction arrows and field-of-view cones.
- Add / edit / delete cameras, with a PII filter that blocks anything that
  looks like personal data.
- **Quick add** mode for officers on foot — geolocation, four big type
  buttons, a direction dial that can read the phone compass, and a one-tap
  save.
- **Pick an area** circle filter — draw a circle and export only the cameras
  inside it as a CSV.
- Base layer switcher — Road / Plain / Satellite (Esri) / Humanitarian.
- **Possible camera sites** overlay — petrol stations, supermarkets
  (Tesco / Asda / Sainsbury's / Morrisons / Aldi / Lidl / Co-op / Iceland /
  Waitrose / M&S) and already-mapped public CCTV, fetched live from
  OpenStreetMap.
- CSV export of all cameras, area-only export when a circle is active.

## How it works

- All data lives in **one plain JSON file** (`cctv-data.json`) in the
  OneDrive / SharePoint folder you choose — human-readable, no encryption.
  Access control is the folder's own SharePoint/OneDrive permissions, not
  anything the app enforces.
- The app reads and writes that file using the browser's File System Access
  API. Chrome / Edge on desktop and Android Chrome are supported. iOS Safari
  is not.
- OneDrive sync distributes the file to every team member's machine.
- Concurrent edits are not auto-merged. The app detects when the file has
  changed under it and prompts you to reload before saving — exactly like
  a shared Excel workbook.
- Attribution is per-action, not per-session: whoever adds or edits a camera
  types their initials right there in that form (pre-filled from last time).
  Just browsing or reviewing the map never asks for a name.

## Set it up

1. Build the single HTML file:
   ```sh
   npm install
   npm run build
   ```
   The output is `dist/sussex-cctv-registry.html` (~1 MB).
2. Put `sussex-cctv-registry.html` in a shared SharePoint / OneDrive folder
   (e.g. `Documents/CCTV Registry/`).
3. Share that folder with your colleagues.
4. Each person opens the file via OneDrive sync (it ends up in
   `…/OneDrive - Sussex Police/CCTV Registry/`), double-clicking it to open
   in Chrome or Edge.
5. Everyone chooses the same folder when the app asks — that's the whole
   setup. The first person to connect creates the data file; everyone else
   just connects to the existing one.

### If SharePoint blocks `.html` upload

Some Microsoft 365 tenants ban uploading `.html` files. Workarounds:

- **Zip it.** Upload `sussex-cctv-registry.zip`; users unzip locally inside
  their OneDrive folder.
- **Rename to `.htm`.** Most tenants only block `.html`.
- **Distribute the app via Teams / email** and only keep `cctv-data.json` in
  the shared folder.

## Day-to-day use

- **Add a camera**: click "Add a camera" in the sidebar, click the map to
  drop the pin, fill in the form, save.
- **Quick add (mobile)**: tap "Quick add" → location is captured → tap a
  type → drag the dial or use the phone compass → save.
- **Pick an area**: open the map controls (top-right), click "Filter Area by
  Circle", draw on the map, then export the cameras inside as a CSV.
- **Possible sites**: toggle the "Possible sites" button in the header to
  show petrol stations, supermarkets and existing public CCTV from OSM.
  Click any of them to pre-fill the Add Camera form.
- **Disconnect**: the button in the top-right returns you to the folder-pick
  screen — useful for switching to a different registry folder.

## Limits and risks (please read)

- **No app-level access control.** Anyone with access to the SharePoint /
  OneDrive folder can read and edit the data — the folder's own permissions
  are the only gate. Manage who can access that folder carefully.
- **Concurrent edits.** Two people saving at the same time will produce a
  OneDrive conflict copy. The app warns the second saver, but accept that
  some overwrite risk exists.
- **No per-officer audit.** Camera entries show whoever's "initials" were
  typed in at the time, but those are self-reported and informational, not
  authentication.
- Use **Settings → Download CSV backup** regularly in case the data file is
  ever lost or corrupted.
- **iOS Safari is not supported.** Use Chrome / Edge on a laptop or Android.
- **Map tiles and Overpass POIs come from public services**
  (OpenStreetMap, Esri, Nominatim, Overpass). Each request goes out from
  the user's browser; this is fine for small-team use under their fair-use
  policies. Don't put the file on a public-internet device and don't share
  with strangers.
- **Data classification.** Storage is the Sussex Police M365 tenant —
  the correct place — but this tool is **unofficial**. Get force IG sign-off
  before storing real registry data.

## What was removed (vs. earlier iterations)

This pivot replaces an earlier multi-officer, server-backed build
(Express + Postgres + LDAP) with a single-file local app. The following
features are no longer present and would need a backend to exist:

- Real-time multi-user sync via Server-Sent Events
- Per-officer accounts (LDAP), audit log, bulk officer invites
- 3-day temporary access windows
- Server-enforced role-based access control

A later revision of this same single-file app also dropped its own
shared-password / AES-encryption layer and the standalone Live Feeds
dashboard, since the app only ever runs inside the already-authenticated
Sussex Police M365 tenant and folder permissions were doing the real
access-control work anyway.

## Credits

- App by **Nathan Tracey**, Sussex Police.
- Map tiles by [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- Satellite imagery by Esri (World Imagery service).
- Place search by [Nominatim](https://nominatim.openstreetmap.org/) (OSM).
- POI lookups by [Overpass API](https://overpass-api.de/) (OSM).
- Built with React, Vite, Leaflet, react-leaflet, Tailwind CSS, lucide-react,
  recharts and papaparse.
