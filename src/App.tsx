import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  FileDown,
  Focus,
  HelpCircle,
  Info,
  Layers,
  LocateFixed,
  LockKeyhole,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Route,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Video,
  X,
} from "lucide-react";
import CCTVMap from "./CCTVMap";
import CameraForm from "./CameraForm";
import Modal from "./Modal";
import { api, setCSRF } from "./api";
import {
  cameraCSV,
  dateLabel,
  distance,
  isStale,
  kindLabel,
  routeMatches,
  type CameraRecord,
  type Point,
} from "./domain";

type Tab = "map" | "list" | "route";
const defaultPoint = { lat: 50.8135, lng: -0.3705 };
function PrivacyContent() {
  return (
    <div className="policy-content">
      <div className="info-box warning">
        <Shield size={21} />
        <span>
          <strong>Test environment — not approved for operational use.</strong>{" "}
          A password and these safeguards do not constitute police
          accreditation.
        </span>
      </div>
      <h3>What belongs in this register</h3>
      <p>
        Public-facing business and public authority cameras, public premises
        addresses and verified organisation contact numbers. No household CCTV,
        doorbells, ANPR, footage, names, personal contacts or case narratives.
      </p>
      <h3>Keep personal information on police systems</h3>
      <p>
        Use an asset reference for the camera. A reference linked to an
        identifiable person may still be personal data. Published details may
        also identify a sole trader. Do not enter these in this test.
      </p>
      <h3>Maps, routes and location</h3>
      <p>
        OpenStreetMap receives your IP address and the map tiles you view. Road
        routing sends the chosen coordinates through this server to the public
        OSRM demonstration service. It is an indicative driving route, not an
        evidential reconstruction. Manual tracing does not send a routing
        request. Optional nearby-business lookup sends the camera coordinates to
        OpenStreetMap’s Overpass service; listings require your review and do
        not establish camera presence.
      </p>
      <p>
        GPS is requested only when you press a location button. It is not
        continuously tracked. Saving a camera stores its chosen location. Search
        terms and routes are not saved by this application; infrastructure
        providers may process technical traffic.
      </p>
      <h3>Photos and exports</h3>
      <p>
        Reference photos must show the camera only. Review and redact
        identifiable details before saving. JPEG metadata is stripped; there is
        no automatic face or number-plate detection. Photos require sign-in. CSV
        files and email drafts leave the app: use approved police storage and
        email only.
      </p>
      <h3>Access and retention</h3>
      <p>
        The test uses a shared password, an eight-hour maximum session and a
        30-minute server inactivity limit. Sessions are held in an essential,
        secure HTTP-only cookie. There are no advertising or analytics cookies.
        Browser storage is not used for camera records, routes or passwords.
      </p>
      <p>
        Camera data and reviewed photos are stored in a Cloudflare D1 database
        restricted to the EU. This is not a UK-only hosting guarantee.
        Non-identifying change events are retained for 14 days; short-lived
        pseudonymous login-throttling records are also processed. Cloudflare may
        process network identifiers under its service terms. Backups may retain
        deleted data temporarily.
      </p>
      <h3>Before police use</h3>
      <p>
        The force must approve the controller, lawful basis, DPIA, security
        assessment, processor agreements, international transfers, retention,
        audit trail, access controls and mapping services. Named accounts, MFA,
        role-based permissions and independent testing are still required. Ask
        the project owner to correct or remove test records; use force channels
        for any actual data incident.
      </p>
      <div className="policy-links">
        <a
          href="https://www.legislation.gov.uk/ukpga/2018/12/part/3"
          target="_blank"
          rel="noreferrer"
        >
          Data Protection Act 2018, Part 3 ↗
        </a>
        <a
          href="https://ico.org.uk/for-organisations/law-enforcement/guide-to-le-processing/"
          target="_blank"
          rel="noreferrer"
        >
          ICO law enforcement guidance ↗
        </a>
        <a
          href="https://developers.google.com/maps/documentation/places/web-service/policies"
          target="_blank"
          rel="noreferrer"
        >
          Google Places data restrictions ↗
        </a>
      </div>
    </div>
  );
}
function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "small" : "")}>
      <div className="brand-mark">
        <Shield size={small ? 22 : 27} />
        <Video size={small ? 11 : 13} className="brand-camera" />
      </div>
      <div>
        <strong>
          CCTV <span>Enquiries</span>
        </strong>
        <small>SUSSEX CAMERA REGISTER</small>
      </div>
    </div>
  );
}
function Login({
  onLogin,
  onPrivacy,
}: {
  onLogin: () => void;
  onPrivacy: () => void;
}) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-copy">
          <span className="eyebrow">A CLEARER PICTURE. A QUICKER ENQUIRY.</span>
          <h1>
            Find the cameras.
            <br />
            <span>Follow the route.</span>
          </h1>
          <p>
            A focused workspace for CCTV enquiries.
            <br />
            Built for the desk and the street.
          </p>
          <div className="login-features">
            <span>
              <MapPin />
              Explore the camera map
            </span>
            <span>
              <Route />
              Build a route enquiry list
            </span>
            <span>
              <Plus />
              Record a camera on the go
            </span>
          </div>
        </div>
        <div className="login-footer">
          PUBLIC-FACING CCTV ONLY <span>•</span> DESIGNED FOR SUSSEX
        </div>
      </section>
      <section className="login-form-side">
        <form
          className="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await api("/login", {
                method: "POST",
                body: JSON.stringify({ password }),
              });
              setCSRF(r.csrf);
              setPassword("");
              onLogin();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="login-lock">
            <LockKeyhole size={27} />
          </div>
          <div className="test-pill">CONTROLLED TEST VERSION</div>
          <h2>Open your workspace</h2>
          <p>Enter the shared test password to continue.</p>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              maxLength={200}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
            <ArrowRight size={19} />
          </button>
          <div className="login-notice">
            <ShieldCheck size={20} />
            <p>
              Use test enquiries only. Do not enter personal information,
              incident details or footage.
            </p>
          </div>
          <button type="button" className="text-button" onClick={onPrivacy}>
            Privacy, security & acceptable use <ChevronRight size={15} />
          </button>
        </form>
        <span className="version">
          CCTV Enquiries · v2.0 · Evaluation build
        </span>
      </section>
    </main>
  );
}
export default function App() {
  const [signed, setSigned] = useState(false),
    [checking, setChecking] = useState(true),
    [cameras, setCameras] = useState<CameraRecord[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [privacy, setPrivacy] = useState(false),
    [welcome, setWelcome] = useState(false),
    [tiles, setTiles] = useState(false),
    [tab, setTab] = useState<Tab>("map"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [verifiedOnly, setVerifiedOnly] = useState(false),
    [selected, setSelected] = useState<CameraRecord | null>(null);
  const [form, setForm] = useState<{
      initial: CameraRecord | null;
      point: Point;
    } | null>(null),
    [picking, setPicking] = useState<string | null>(null),
    [focus, setFocus] = useState<{
      point: Point;
      zoom?: number;
      key: number;
    } | null>(null),
    [toast, setToast] = useState("");
  const [waypoints, setWaypoints] = useState<Point[]>([]),
    [route, setRoute] = useState<Point[]>([]),
    [routeMode, setRouteMode] = useState<"road" | "trace">("road"),
    [routeBusy, setRouteBusy] = useState(false),
    [routeDistance, setRouteDistance] = useState(0),
    [radius, setRadius] = useState(50),
    [routeConsent, setRouteConsent] = useState(false),
    [routeNotice, setRouteNotice] = useState(false),
    [routeError, setRouteError] = useState("");
  const [exportOpen, setExportOpen] = useState(false),
    [email, setEmail] = useState(""),
    [exportConfirmed, setExportConfirmed] = useState(false),
    [deleting, setDeleting] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [manualPoint, setManualPoint] = useState("");
  const [mapCentre, setMapCentre] = useState<Point>(defaultPoint);
  const routeVersion = useRef(0);
  const notify = useCallback((text: string) => {
    setToast(text);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  const clearSession = useCallback(() => {
    setSigned(false);
    setCameras([]);
    setSelected(null);
    setForm(null);
    setRoute([]);
    setWaypoints([]);
    setTiles(false);
    setQuery("");
    setEmail("");
    setExportOpen(false);
    setWelcome(false);
    setPicking(null);
    setRouteConsent(false);
    setRouteNotice(false);
    setCSRF("");
    routeVersion.current++;
  }, []);
  useEffect(() => {
    api("/session")
      .then((r) => {
        setCSRF(r.csrf);
        setSigned(true);
        setWelcome(true);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
    window.addEventListener("session-expired", clearSession);
    return () => window.removeEventListener("session-expired", clearSession);
  }, [clearSession]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ cameras: CameraRecord[] }>("/cameras");
      setCameras(r.cameras);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (signed) refresh();
  }, [signed, refresh]);
  useEffect(() => {
    if (!signed) return;
    let lastActivity = Date.now();
    const activity = () => {
      lastActivity = Date.now();
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    const t = setInterval(() => {
      if (Date.now() - lastActivity > 29 * 60000) {
        api("/logout", { method: "POST", body: "{}" }).catch(() => {});
        clearSession();
      }
    }, 30000);
    return () => {
      clearInterval(t);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [signed, clearSession]);
  const filtered = useMemo(
    () =>
      cameras.filter(
        (c) =>
          (filter === "all" || c.kind === filter) &&
          (!verifiedOnly || !isStale(c)) &&
          [c.name, c.address, c.assetReference, c.id].some((x) =>
            x.toLowerCase().includes(query.toLowerCase()),
          ),
      ),
    [cameras, filter, query, verifiedOnly],
  );
  const matches = useMemo(
    () => routeMatches(filtered, route, radius),
    [filtered, route, radius],
  );
  const displayed =
    tab === "route" && route.length > 1
      ? matches.map((x) => x.camera)
      : filtered;
  const exportCameras = displayed;
  const councilCount = cameras.filter((c) => c.kind === "council").length;
  const selectedId = selected?.id || null;
  function fly(point: Point, zoom = 18) {
    setFocus({ point, zoom, key: Date.now() });
  }
  function select(c: CameraRecord) {
    setSelected(c);
    fly(c);
  }
  function invalidateRoute() {
    routeVersion.current++;
    setRoute([]);
    setRouteDistance(0);
    setRouteError("");
    setRouteBusy(false);
  }
  function setPoints(points: Point[]) {
    invalidateRoute();
    setWaypoints(points);
    if (routeMode === "trace" && points.length > 1) {
      setRoute(points);
      setRouteDistance(
        points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0),
      );
    }
  }
  function pointChosen(p: Point) {
    if (picking === "add") {
      setPicking(null);
      setForm({ initial: null, point: p });
      return;
    }
    if (picking === "a") {
      setPoints([p, ...waypoints.slice(1)]);
      setPicking("b");
      notify("Start set. Now choose the end point.");
    } else if (picking === "b") {
      setPoints([waypoints[0] || defaultPoint, p]);
      setPicking(null);
      setTab("route");
    } else if (picking === "trace") {
      if (waypoints.length >= 12) {
        notify("A route can contain up to 12 points.");
        return;
      }
      setPoints([...waypoints, p]);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      notify("Location is not available on this device.");
      return;
    }
    notify("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        fly({ lat: p.coords.latitude, lng: p.coords.longitude }, 17);
        notify(
          `Location accuracy: approximately ${Math.round(p.coords.accuracy)} metres.`,
        );
      },
      () =>
        notify(
          "Location unavailable. Check browser permissions or use the map.",
        ),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }
  async function calculate() {
    if (waypoints.length < 2) return;
    if (!routeConsent) {
      setRouteNotice(true);
      return;
    }
    setRouteBusy(true);
    setRouteError("");
    const version = ++routeVersion.current;
    setRoute([]);
    try {
      const r = await api("/route", {
        method: "POST",
        body: JSON.stringify({ points: waypoints, externalConsent: true }),
      });
      if (version !== routeVersion.current) return;
      setRoute(r.points);
      setRouteDistance(r.distance);
      setPicking(null);
      notify("Route ready. Camera candidates are listed in route order.");
    } catch (e) {
      if (version === routeVersion.current) setRouteError((e as Error).message);
    } finally {
      if (version === routeVersion.current) setRouteBusy(false);
    }
  }
  function download() {
    const blob = new Blob(
      [cameraCSV(exportCameras, tab === "route" ? route : [])],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `cctv-enquiry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Camera list exported. Store it on an approved police system.");
  }
  function emailDraft() {
    if (!/^[^\s@]+@(?:[a-z0-9-]+\.)*police\.uk$/i.test(email)) {
      notify("Enter an approved police.uk email address.");
      return;
    }
    const lines = exportCameras.map(
      (c, i) =>
        `${i + 1}. ${c.name}\n${c.address || "Address not recorded"}\n${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}${c.publicPhone ? "\nPublic tel: " + c.publicPhone : ""}\nAsset: ${c.assetReference || c.id}\nVerified: ${dateLabel(c.verifiedAt)}`,
    );
    let body =
      `CCTV enquiry candidates — TEST ONLY\n${exportCameras.length} cameras${tab === "route" ? ` within ${radius} m of the ${routeMode === "road" ? "indicative driving" : "manually traced"} route` : ""}. Proximity does not confirm footage coverage. Verify location, view and retention.\n\n` +
      lines.join("\n\n");
    if (body.length > 9000) {
      download();
      body = `CCTV enquiry candidates — TEST ONLY\n${exportCameras.length} cameras. Please attach the CSV just downloaded. Verify location, view and retention before use.`;
    }
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("CCTV enquiry camera list — test")}&body=${encodeURIComponent(body)}`;
    notify(
      "Email draft prepared. Review it in your approved mail application; nothing was sent by this website.",
    );
  }
  function openExport() {
    setExportConfirmed(false);
    setExportOpen(true);
  }
  function beginAdd() {
    setSelected(null);
    setPicking("add");
    setTab("map");
    notify(
      "Tap the camera position on the map, or use Quick add at map centre.",
    );
  }
  const pickingText =
    picking === "add"
      ? "Tap the map to place a camera"
      : picking === "a"
        ? "Choose point A · route start"
        : picking === "b"
          ? "Choose point B · route end"
          : picking === "trace"
            ? "Tap to trace the route · add points at each turn"
            : null;
  const cameraList = (
    <div className="camera-list">
      {loading ? (
        <div className="empty">
          <RefreshCw className="spin" />
          <h3>Loading cameras…</h3>
        </div>
      ) : displayed.length === 0 ? (
        <div className="empty">
          <Search size={30} />
          <h3>
            {route.length > 1
              ? "No cameras in this corridor"
              : "No matching cameras"}
          </h3>
          <p>
            {route.length > 1
              ? "Try a wider corridor or check your route."
              : "Change your search or filters."}
          </p>
        </div>
      ) : (
        displayed.map((c, i) => (
          <button
            key={c.id}
            className={"camera-row " + (selectedId === c.id ? "active" : "")}
            onClick={() => select(c)}
          >
            <span className={"row-icon " + c.kind}>
              {tab === "route" && route.length > 1 ? (
                <b>{i + 1}</b>
              ) : (
                <Video size={19} />
              )}
            </span>
            <span className="row-body">
              <strong>{c.name}</strong>
              <span>
                {c.address || kindLabel(c.kind) + " · address to confirm"}
              </span>
              <small
                className={isStale(c) ? "status-unverified" : "status-verified"}
              >
                <i />
                {isStale(c)
                  ? "Needs verification"
                  : "Verified " + dateLabel(c.verifiedAt)}
                {tab === "route" && route.length > 1 && (
                  <em>{Math.round(matches[i]?.distance || 0)} m from route</em>
                )}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        ))
      )}
    </div>
  );
  const privacyModal = privacy && (
    <Modal
      title="Privacy & responsible use"
      subtitle="Know what is stored and where it goes"
      onClose={() => setPrivacy(false)}
      wide
    >
      <PrivacyContent />
      <div className="modal-foot">
        <button className="primary" onClick={() => setPrivacy(false)}>
          Close
        </button>
      </div>
    </Modal>
  );
  if (checking)
    return (
      <div className="loading-screen">
        <Brand />
        <p>Opening workspace…</p>
      </div>
    );
  if (!signed)
    return (
      <>
        <Login
          onLogin={() => {
            setSigned(true);
            setWelcome(true);
          }}
          onPrivacy={() => setPrivacy(true)}
        />
        {privacyModal}
      </>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <aside className="rail">
        <div className="rail-logo">
          <Shield size={27} />
        </div>
        <button
          title="Camera map"
          aria-label="Camera map"
          className={tab !== "route" ? "active" : ""}
          onClick={() => {
            setTab("map");
            setPicking(null);
          }}
        >
          <MapIcon />
          <span>Explore</span>
        </button>
        <button
          title="Route enquiry"
          aria-label="Route enquiry"
          className={tab === "route" ? "active" : ""}
          onClick={() => {
            setTab("route");
            setSelected(null);
            setPicking(null);
          }}
        >
          <Route />
          <span>Route</span>
        </button>
        <button title="Add camera" aria-label="Add camera" onClick={beginAdd}>
          <Plus />
          <span>Add</span>
        </button>
        <div className="rail-bottom">
          <button
            aria-label="Privacy and security"
            onClick={() => setPrivacy(true)}
          >
            <ShieldCheck />
          </button>
          <span>v2.0</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <Brand small />
          <div className="header-actions">
            <span className="environment">
              <i />
              TEST WORKSPACE
            </span>
            <button
              className="secondary header-help"
              onClick={() => setPrivacy(true)}
            >
              <HelpCircle size={17} />
              Guidance
            </button>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                try {
                  await api("/logout", { method: "POST", body: "{}" });
                  clearSession();
                } catch (e) {
                  setError(
                    "Sign-out could not be confirmed. Try again; close the browser if you are leaving the device.",
                  );
                }
              }}
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <div className="test-strip">
          <ShieldCheck size={14} />
          <span>
            Evaluation only. No personal details, ANPR, household cameras or
            footage.
          </span>
          <button onClick={() => setPrivacy(true)}>
            Data rules <ArrowRight size={13} />
          </button>
        </div>
        <main id="workspace" className={"main-layout tab-" + tab}>
          <section
            className="side-panel"
            aria-label={
              tab === "route"
                ? "Route enquiry controls"
                : "Camera search and list"
            }
          >
            <div className="panel-top">
              <div className="eyebrow">
                {tab === "route" ? "BUILD AN ENQUIRY" : "YOUR CAMERA REGISTER"}
              </div>
              <div className="panel-title">
                <h1>{tab === "route" ? "Follow a route" : "Find a camera"}</h1>
                <button
                  className="icon-button"
                  aria-label="Refresh camera list"
                  onClick={refresh}
                >
                  <RefreshCw size={17} className={loading ? "spin" : ""} />
                </button>
              </div>
              <p className="panel-intro">
                {tab === "route"
                  ? "Plan the path. Find the cameras to check."
                  : "Public-facing cameras, all in one place."}
              </p>
              {tab !== "route" && (
                <>
                  <div className="stats">
                    <div>
                      <strong>{cameras.length}</strong>
                      <span>registered cameras</span>
                    </div>
                    <div>
                      <strong>{councilCount}</strong>
                      <span>public authority</span>
                    </div>
                  </div>
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      aria-label="Search cameras"
                      placeholder="Search site, address or reference"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <div className="filter-chips">
                    {[
                      ["all", "All cameras"],
                      ["business", "Business"],
                      ["council", "Public authority"],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        aria-pressed={filter === v}
                        className={filter === v ? "active" : ""}
                        onClick={() => setFilter(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <label className="toggle-line">
                    <input
                      type="checkbox"
                      checked={verifiedOnly}
                      onChange={(e) => setVerifiedOnly(e.target.checked)}
                    />
                    Verified in the last 6 months
                  </label>
                </>
              )}
              {tab === "route" && (
                <>
                  <div className="segmented">
                    <button
                      className={routeMode === "road" ? "active" : ""}
                      onClick={() => {
                        setRouteMode("road");
                        setWaypoints([]);
                        invalidateRoute();
                        setPicking(null);
                      }}
                    >
                      Road route
                    </button>
                    <button
                      className={routeMode === "trace" ? "active" : ""}
                      onClick={() => {
                        setRouteMode("trace");
                        setWaypoints([]);
                        invalidateRoute();
                        setPicking(null);
                      }}
                    >
                      Trace manually
                    </button>
                  </div>
                  <div className="route-points">
                    <button
                      className={picking === "a" ? "point active" : "point"}
                      onClick={() => {
                        setPicking("a");
                        setSelected(null);
                      }}
                    >
                      <b>A</b>
                      <span>
                        <strong>Start point</strong>
                        <small>
                          {waypoints[0]
                            ? `${waypoints[0].lat.toFixed(5)}, ${waypoints[0].lng.toFixed(5)}`
                            : "Choose on the map"}
                        </small>
                      </span>
                      <MapPin size={17} />
                    </button>
                    <div className="point-connector" />
                    <button
                      className={picking === "b" ? "point active" : "point"}
                      disabled={!waypoints[0]}
                      onClick={() => setPicking("b")}
                    >
                      <b>B</b>
                      <span>
                        <strong>End point</strong>
                        <small>
                          {waypoints.length > 1
                            ? `${waypoints.at(-1)!.lat.toFixed(5)}, ${waypoints.at(-1)!.lng.toFixed(5)}`
                            : "Choose on the map"}
                        </small>
                      </span>
                      <MapPin size={17} />
                    </button>
                  </div>
                  {picking && picking !== "add" && (
                    <form
                      className="coordinate-entry"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const parts = manualPoint.split(",").map(Number);
                        if (
                          parts.length === 2 &&
                          parts[0] >= 49 &&
                          parts[0] <= 61 &&
                          parts[1] >= -9 &&
                          parts[1] <= 3
                        ) {
                          pointChosen({ lat: parts[0], lng: parts[1] });
                          setManualPoint("");
                        } else
                          notify(
                            "Enter UK latitude, longitude, separated by a comma.",
                          );
                      }}
                    >
                      <label>
                        Or enter coordinates
                        <input
                          placeholder="50.81410, -0.37460"
                          aria-label="Route point coordinates"
                          value={manualPoint}
                          onChange={(e) => setManualPoint(e.target.value)}
                          required
                        />
                      </label>
                      <button className="secondary" type="submit">
                        Set point
                      </button>
                    </form>
                  )}
                  {routeMode === "road" ? (
                    <button
                      className="primary full"
                      disabled={waypoints.length < 2 || routeBusy}
                      onClick={calculate}
                    >
                      <Route size={18} />
                      {routeBusy
                        ? "Finding road route…"
                        : "Find cameras along route"}
                    </button>
                  ) : (
                    <div className="button-row">
                      <button
                        className="primary"
                        onClick={() => {
                          setPicking(picking === "trace" ? null : "trace");
                        }}
                      >
                        {picking === "trace"
                          ? "Finish tracing"
                          : "Add route points"}
                      </button>
                      <button
                        className="secondary"
                        disabled={!waypoints.length}
                        onClick={() => setPoints(waypoints.slice(0, -1))}
                      >
                        Undo
                      </button>
                    </div>
                  )}
                  <p className="help">
                    {routeMode === "road"
                      ? "Indicative driving route. For a walking or observed path, trace it manually."
                      : "Connect points at each turn. Lines follow your chosen points, not the road network."}
                  </p>
                  <label className="radius-label">
                    <span>Search either side of route</span>
                    <select
                      aria-label="Route search corridor"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                    >
                      {[25, 50, 100, 200].map((r) => (
                        <option key={r} value={r}>
                          {r} metres
                        </option>
                      ))}
                    </select>
                  </label>
                  {routeError && (
                    <p className="form-error" role="alert">
                      {routeError}
                    </p>
                  )}
                  {route.length > 1 && (
                    <div className="route-summary">
                      <div>
                        <strong>
                          {(routeDistance / 1000).toFixed(2)} <small>km</small>
                        </strong>
                        <span>
                          {routeMode === "road"
                            ? "Driving route"
                            : "Manual trace"}
                        </span>
                      </div>
                      <div>
                        <strong>{matches.length}</strong>
                        <span>camera candidates</span>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Clear route"
                        onClick={() => {
                          setPoints([]);
                          setPicking(null);
                        }}
                      >
                        <X size={17} />
                      </button>
                    </div>
                  )}
                  {(query || filter !== "all" || verifiedOnly) && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                        setVerifiedOnly(false);
                      }}
                    >
                      Clear camera filters for this route
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="list-heading">
              <span>
                {tab === "route" && route.length > 1
                  ? "CAMERAS IN ROUTE ORDER"
                  : "CAMERA LOCATIONS"}
              </span>
              <b>{displayed.length}</b>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
                <button className="text-button" onClick={refresh}>
                  Try again
                </button>
              </div>
            )}
            {tab === "route" && route.length === 0 ? (
              <div className="route-empty">
                <div>
                  <Route size={32} />
                </div>
                <h3>Your route starts here</h3>
                <p>
                  Choose a start and end point on the map. Nearby camera
                  candidates will appear here.
                </p>
                <span>
                  <Info size={14} />
                  Proximity does not confirm coverage.
                </span>
              </div>
            ) : (
              cameraList
            )}
            <div className="panel-bottom">
              <button
                className="secondary full"
                onClick={openExport}
                disabled={
                  !displayed.length || (tab === "route" && route.length < 2)
                }
              >
                <FileDown size={18} />
                Export or email {tab === "route" ? "route list" : "camera list"}
                <ChevronRight size={16} />
              </button>
              <span>
                <LockKeyhole size={11} />
                Camera data stays behind sign-in
              </span>
            </div>
          </section>
          <section className="map-section" aria-label="Camera map">
            <CCTVMap
              cameras={displayed}
              selected={selectedId}
              onSelect={select}
              onPoint={pointChosen}
              picking={pickingText}
              route={route}
              waypoints={waypoints}
              radius={radius}
              focus={focus}
              tiles={tiles}
              onLocate={locate}
              onCentreChange={setMapCentre}
            />
            <div className="map-top-actions">
              <button
                className="map-action"
                onClick={() => {
                  setTab("route");
                  setSelected(null);
                }}
              >
                <Route size={18} />
                Plan a route
              </button>
              <button className="primary" onClick={beginAdd}>
                <Plus size={19} />
                Add camera
              </button>
            </div>
            {picking === "add" && (
              <div className="map-bottom-action">
                <button
                  className="primary"
                  onClick={() => {
                    setPicking(null);
                    setForm({ initial: null, point: mapCentre });
                  }}
                >
                  <LocateFixed size={18} />
                  Open quick add / GPS
                </button>
                <button className="secondary" onClick={() => setPicking(null)}>
                  Cancel
                </button>
              </div>
            )}
            {picking && picking !== "add" && (
              <div className="map-bottom-action">
                <button className="secondary" onClick={() => setPicking(null)}>
                  <Check size={17} />
                  {picking === "trace"
                    ? "Finish tracing"
                    : "Cancel point selection"}
                </button>
              </div>
            )}
            {!tiles && !welcome && (
              <div className="tiles-off">
                <Layers size={27} />
                <strong>External map tiles are off</strong>
                <p>You can use the camera list, or enable test maps.</p>
                <button className="primary" onClick={() => setWelcome(true)}>
                  Review map access
                </button>
              </div>
            )}
          </section>
        </main>
        <nav className="mobile-nav" aria-label="Main navigation">
          <button
            className={tab === "map" ? "active" : ""}
            onClick={() => {
              setTab("map");
              setPicking(null);
            }}
          >
            <MapIcon size={21} />
            Map
          </button>
          <button
            className={tab === "list" ? "active" : ""}
            onClick={() => {
              setTab("list");
              setPicking(null);
            }}
          >
            <Layers size={21} />
            Cameras
          </button>
          <button
            className={tab === "route" ? "active" : ""}
            onClick={() => {
              setTab("route");
              setSelected(null);
            }}
          >
            <Route size={21} />
            Route
          </button>
          <button onClick={() => setForm({ initial: null, point: mapCentre })}>
            <Plus size={23} />
            Quick add
          </button>
        </nav>
      </div>
      {selected && !form && (
        <Modal
          title={selected.name}
          subtitle={kindLabel(selected.kind) + " · Camera record"}
          onClose={() => setSelected(null)}
        >
          <div className="detail-content">
            {selected.hasPhoto ? (
              <img
                className="detail-photo"
                src={`/api/cameras/${selected.id}/photo?v=${selected.revision}`}
                alt={`Reference view of the camera at ${selected.name}`}
              />
            ) : (
              <div className="no-photo">
                <Video size={40} />
                <span>No reference photo yet</span>
              </div>
            )}
            <div
              className={
                "verification " + (isStale(selected) ? "pending" : "complete")
              }
            >
              <Clock3 size={17} />
              {isStale(selected)
                ? "Needs verification before an enquiry"
                : "Verified " + dateLabel(selected.verifiedAt)}
            </div>
            <dl className="details">
              <dt>Public address</dt>
              <dd>{selected.address || "Not recorded — confirm on site"}</dd>
              <dt>Coordinates</dt>
              <dd>
                {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
              </dd>
              <dt>Public telephone</dt>
              <dd>
                {selected.publicPhone ? (
                  <a href={"tel:" + selected.publicPhone}>
                    {selected.publicPhone}
                  </a>
                ) : (
                  "Not recorded"
                )}
              </dd>
              {selected.contactSource && (
                <>
                  <dt>Contact source</dt>
                  <dd>
                    <a
                      href={selected.contactSource}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Organisation website ↗
                    </a>
                  </dd>
                </>
              )}
              <dt>Police asset reference</dt>
              <dd>{selected.assetReference || "Not recorded"}</dd>
              <dt>Reported retention</dt>
              <dd>
                {selected.retentionDays
                  ? `${selected.retentionDays} days — confirm with operator`
                  : "Unknown — enquire promptly"}
              </dd>
              <dt>Camera view estimate</dt>
              <dd>
                {selected.direction}° bearing · {selected.fieldOfView}° field ·{" "}
                {selected.viewDistance} m
              </dd>
              <dt>Source</dt>
              <dd>
                {selected.source}
                {selected.placeSource && (
                  <>
                    <br />
                    <a
                      href={selected.placeSource}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Place details © OpenStreetMap contributors (ODbL) ↗
                    </a>
                  </>
                )}
              </dd>
            </dl>
            <p className="help">
              An entry confirms neither current operation nor recorded coverage.
              Keep footage requests and investigation details on police systems.
            </p>
          </div>
          <div className="modal-foot">
            <button
              className="icon-button danger-text"
              aria-label="Delete camera"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={18} />
            </button>
            <button
              className="secondary"
              onClick={() => {
                setSelected(null);
                setTab("map");
                fly(selected);
              }}
            >
              View on map
            </button>
            <button
              className="primary"
              onClick={() => setForm({ initial: selected, point: selected })}
            >
              Edit / verify
            </button>
          </div>
        </Modal>
      )}
      {deleteOpen && selected && (
        <Modal title="Delete this camera?" onClose={() => setDeleteOpen(false)}>
          <div className="policy-content">
            <p>
              This removes <strong>{selected.name}</strong> and its reference
              photo from the active test register. A minimal change event is
              retained for 14 days. Provider backups may retain earlier data.
            </p>
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="modal-foot">
            <button className="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
            <button
              className="danger"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await api("/cameras/" + selected.id, {
                    method: "DELETE",
                    body: JSON.stringify({ revision: selected.revision }),
                  });
                  setCameras((old) => old.filter((c) => c.id !== selected.id));
                  setSelected(null);
                  setDeleteOpen(false);
                  notify("Camera removed.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Removing…" : "Delete camera"}
            </button>
          </div>
        </Modal>
      )}
      {form && (
        <CameraForm
          initial={form.initial}
          point={form.point}
          onClose={() => setForm(null)}
          onSaved={(c) => {
            setCameras((old) =>
              [...old.filter((x) => x.id !== c.id), c].sort((a, b) =>
                a.name.localeCompare(b.name),
              ),
            );
            setForm(null);
            setSelected(null);
            fly(c);
            notify(
              "Camera saved. It is available on your other signed-in devices.",
            );
          }}
        />
      )}
      {welcome && (
        <Modal
          title="Before you open the map"
          subtitle="A controlled test using public mapping services"
          onClose={() => {
            setTiles(false);
            setWelcome(false);
          }}
        >
          <div className="policy-content">
            <div className="info-box warning">
              <ShieldCheck size={22} />
              <span>
                This test is not approved for live police investigations.
              </span>
            </div>
            <p>
              <strong>
                OpenStreetMap receives your IP address and the area you view.
              </strong>{" "}
              Road routing has a separate confirmation before coordinates are
              sent to OSRM.
            </p>
            <p>
              Only public-facing business and public authority cameras belong
              here. No personal information, ANPR, household cameras or footage.
              The supplied test records have been filtered and still need site
              verification.
            </p>
            <button className="text-button" onClick={() => setPrivacy(true)}>
              Read full privacy and data rules <ArrowRight size={16} />
            </button>
          </div>
          <div className="modal-foot">
            <button
              className="secondary"
              onClick={() => {
                setTiles(false);
                setWelcome(false);
                setTab("list");
              }}
            >
              Use list only
            </button>
            <button
              className="primary"
              onClick={() => {
                setTiles(true);
                setWelcome(false);
              }}
            >
              Continue with test maps
            </button>
          </div>
        </Modal>
      )}
      {routeNotice && (
        <Modal
          title="Use external road routing?"
          onClose={() => setRouteNotice(false)}
        >
          <div className="policy-content">
            <p>
              The selected coordinates will be sent to the public{" "}
              <strong>OSRM demonstration service</strong> to calculate an
              indicative driving route. Do not use operational routes here.
            </p>
            <p>
              For a path you draw yourself, choose{" "}
              <strong>Trace manually</strong>. No route request is then sent.
            </p>
          </div>
          <div className="modal-foot">
            <button className="secondary" onClick={() => setRouteNotice(false)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => {
                setRouteConsent(true);
                setRouteNotice(false);
                notify(
                  "External test routing enabled. Press Find cameras along route.",
                );
              }}
            >
              Enable test routing
            </button>
          </div>
        </Modal>
      )}
      {exportOpen && (
        <Modal
          title="Your camera enquiry list"
          subtitle={`${exportCameras.length} camera candidates · ${tab === "route" ? "route order" : "current filters"}`}
          onClose={() => setExportOpen(false)}
        >
          <div className="policy-content">
            <div className="export-summary">
              <FileDown size={28} />
              <div>
                <strong>Ready for your enquiry</strong>
                <p>
                  Site, public contact, coordinates, camera view, asset
                  reference and verification date.
                </p>
              </div>
            </div>
            <p className="help">
              Camera positions are candidates only. Confirm field of view,
              working status, time accuracy and retention with the operator.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={exportConfirmed}
                onChange={(e) => setExportConfirmed(e.target.checked)}
              />
              I will use approved police storage and email. This is a test list
              without investigation details.
            </label>
            <button
              className="primary full"
              onClick={download}
              disabled={!exportConfirmed}
            >
              <ArrowDownToLine size={18} />
              Download CSV ({exportCameras.length} cameras)
            </button>
            <div className="email-export">
              <label>
                Approved police email address
                <input
                  type="email"
                  autoComplete="off"
                  placeholder="recipient@force.police.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button
                className="secondary full"
                disabled={!exportConfirmed || !email}
                onClick={emailDraft}
              >
                <Mail size={18} />
                Open an email draft
              </button>
              <p className="help">
                Opens your email app for review. Nothing is sent automatically.
                Large lists download as a CSV to attach.
              </p>
            </div>
          </div>
        </Modal>
      )}
      {privacyModal}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
