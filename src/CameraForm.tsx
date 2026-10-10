import { useState } from "react";
import { LocateFixed, MapPin, ShieldCheck, Check } from "lucide-react";
import type { CameraRecord, Point } from "./domain";
import Modal from "./Modal";
import PhotoEditor from "./PhotoEditor";
import { api } from "./api";
export default function CameraForm({
  initial,
  point,
  onClose,
  onSaved,
}: {
  initial: CameraRecord | null;
  point: Point;
  onClose: () => void;
  onSaved: (c: CameraRecord) => void;
}) {
  const [value, setValue] = useState({
    kind: initial?.kind || "business",
    name: initial?.name || "",
    address: initial?.address || "",
    publicPhone: initial?.publicPhone || "",
    contactSource: initial?.contactSource || "",
    placeSource: initial?.placeSource || "",
    assetReference: initial?.assetReference || "",
    lat: initial?.lat ?? point.lat,
    lng: initial?.lng ?? point.lng,
    direction: initial?.direction ?? 0,
    fieldOfView: initial?.fieldOfView ?? 90,
    viewDistance: initial?.viewDistance ?? 30,
    retentionDays: initial?.retentionDays ?? (null as number | null),
  });
  const [confirmed, setConfirmed] = useState(false),
    [contactConfirmed, setContactConfirmed] = useState(false),
    [photoConfirmed, setPhotoConfirmed] = useState(false),
    [photo, setPhoto] = useState(""),
    [removePhoto, setRemovePhoto] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [gps, setGPS] = useState("");
  const [lookup, setLookup] = useState(false),
    [lookupBusy, setLookupBusy] = useState(false),
    [places, setPlaces] = useState<any[]>([]);
  async function findPlaces() {
    setLookupBusy(true);
    setError("");
    try {
      const r = await api("/places", {
        method: "POST",
        body: JSON.stringify({
          lat: Number(value.lat),
          lng: Number(value.lng),
          externalConsent: true,
        }),
      });
      setPlaces(r.places);
      if (!r.places.length)
        setError(
          "No nearby business listings were found. Enter the details manually.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLookupBusy(false);
    }
  }
  const update = (key: string, v: any) =>
    setValue((old) => ({ ...old, [key]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = {
        ...value,
        publicFacingConfirmed: confirmed,
        contactConfirmed,
        photoConfirmed,
        photo: photo || undefined,
        removePhoto,
        revision: initial?.revision,
      };
      const r = await api<{ camera: CameraRecord }>(
        initial ? "/cameras/" + initial.id : "/cameras",
        { method: initial ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      onSaved(r.camera);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError(
        "GPS is not available. Enter coordinates or choose the position on the map.",
      );
      return;
    }
    setGPS("Getting GPS location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        update("lat", Number(p.coords.latitude.toFixed(7)));
        update("lng", Number(p.coords.longitude.toFixed(7)));
        setGPS(
          `GPS accuracy: approximately ${Math.round(p.coords.accuracy)} metres. Check that the position is the camera, not where you are standing.`,
        );
      },
      () => {
        setGPS("");
        setError(
          "Location access was unavailable. Allow location in browser settings, or use the map and coordinates.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }
  return (
    <Modal
      title={initial ? "Update camera" : "Quick add camera"}
      subtitle="Public-facing CCTV · no footage or personal details"
      onClose={onClose}
      wide
    >
      <form onSubmit={save} className="camera-form">
        <div className="form-body">
          <div className="info-box">
            <ShieldCheck size={20} />
            <span>
              Register the camera and public organisation only. Keep owners’
              details and enquiry records on police systems.
            </span>
          </div>
          <fieldset>
            <legend>
              1 <span>Camera location</span>
            </legend>
            <button type="button" className="secondary full" onClick={locate}>
              <LocateFixed size={18} />
              Use my GPS location
            </button>
            {gps && (
              <p className="help" role="status">
                {gps}
              </p>
            )}
            <div className="form-grid">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  min="49"
                  max="61"
                  required
                  value={value.lat}
                  onChange={(e) =>
                    update(
                      "lat",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  min="-9"
                  max="3"
                  required
                  value={value.lng}
                  onChange={(e) =>
                    update(
                      "lng",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </label>
            </div>
            <p className="help">
              <MapPin size={13} />
              The initial position is{" "}
              {initial
                ? "the saved camera position"
                : "your chosen point on the map"}
              . You can correct the coordinates.
            </p>
          </fieldset>
          <fieldset>
            <legend>
              2 <span>Public site details</span>
            </legend>
            <div className="segmented">
              <button
                type="button"
                className={value.kind === "business" ? "active" : ""}
                onClick={() => update("kind", "business")}
              >
                Business CCTV
              </button>
              <button
                type="button"
                className={value.kind === "council" ? "active" : ""}
                onClick={() => update("kind", "council")}
              >
                Public authority
              </button>
            </div>
            <div className="business-lookup">
              <button
                type="button"
                className="text-button"
                onClick={() => setLookup((v) => !v)}
              >
                <MapPin size={15} />
                Find nearby public business details
              </button>
              {lookup && (
                <div className="lookup-panel">
                  <p className="help">
                    Send this test location to OpenStreetMap’s Overpass service
                    to find businesses within 150 m. A listing does not
                    establish that CCTV exists. Review every detail before
                    saving.
                  </p>
                  <button
                    type="button"
                    className="secondary full"
                    disabled={lookupBusy}
                    onClick={findPlaces}
                  >
                    {lookupBusy
                      ? "Finding businesses…"
                      : "Look up this test location"}
                  </button>
                  {places.map((p, i) => (
                    <button
                      type="button"
                      className="place-result"
                      key={i}
                      onClick={() => {
                        setValue((v) => ({
                          ...v,
                          name: p.name,
                          address: p.address,
                          publicPhone: p.publicPhone,
                          contactSource: p.contactSource,
                          placeSource: p.placeSource,
                        }));
                        setContactConfirmed(false);
                        setConfirmed(false);
                        setLookup(false);
                      }}
                    >
                      <strong>{p.name}</strong>
                      <span>{p.address || "Address not listed"}</span>
                    </button>
                  ))}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                    className="help"
                  >
                    © OpenStreetMap contributors · ODbL
                  </a>
                </div>
              )}
              {value.placeSource && (
                <p className="help">
                  Suggested details from{" "}
                  <a href={value.placeSource} target="_blank" rel="noreferrer">
                    OpenStreetMap
                  </a>
                  . Camera location remains unchanged.
                </p>
              )}
            </div>
            <label>
              Public business or site name <span className="required">*</span>
              <input
                autoComplete="off"
                required
                maxLength={100}
                placeholder="e.g. Boots, Montague Street"
                value={value.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </label>
            <label>
              Public premises address
              <input
                autoComplete="off"
                maxLength={200}
                placeholder="Public business address, not a home address"
                value={value.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Public telephone <span className="optional">optional</span>
                <input
                  type="tel"
                  maxLength={24}
                  placeholder="Organisation number only"
                  value={value.publicPhone}
                  onChange={(e) => update("publicPhone", e.target.value)}
                />
              </label>
              <label>
                Police asset reference{" "}
                <span className="optional">optional</span>
                <input
                  maxLength={40}
                  placeholder="e.g. CCTV-WOR-0042"
                  value={value.assetReference}
                  onChange={(e) => update("assetReference", e.target.value)}
                />
              </label>
            </div>
            <p className="help">
              Use a camera asset reference, never a crime, incident or person
              reference.
            </p>
            {value.publicPhone && (
              <>
                <label>
                  Organisation website confirming the number
                  <input
                    type="url"
                    required
                    maxLength={250}
                    placeholder="https://organisation.example/contact"
                    value={value.contactSource}
                    onChange={(e) => update("contactSource", e.target.value)}
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    required
                    checked={contactConfirmed}
                    onChange={(e) => setContactConfirmed(e.target.checked)}
                  />
                  This is a published organisation number, not a personal or
                  sole-trader contact.
                </label>
              </>
            )}
          </fieldset>
          <fieldset>
            <legend>
              3 <span>Camera view</span>
            </legend>
            <div className="form-grid three">
              <label>
                Direction (°)
                <input
                  type="number"
                  min="0"
                  max="359"
                  required
                  value={value.direction}
                  onChange={(e) =>
                    update(
                      "direction",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Field of view (°)
                <input
                  type="number"
                  min="1"
                  max="360"
                  required
                  value={value.fieldOfView}
                  onChange={(e) =>
                    update(
                      "fieldOfView",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                View distance (m)
                <input
                  type="number"
                  min="1"
                  max="300"
                  required
                  value={value.viewDistance}
                  onChange={(e) =>
                    update(
                      "viewDistance",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </label>
            </div>
            <p className="help">
              0° = north · 90° = east · estimates only. These do not prove a
              location was recorded.
            </p>
            <label>
              Reported recording retention
              <select
                value={value.retentionDays ?? ""}
                onChange={(e) =>
                  update(
                    "retentionDays",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              >
                <option value="">Unknown — confirm with operator</option>
                {[1, 3, 7, 14, 28, 30, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>
              4 <span>Reference photo</span>
            </legend>
            {initial?.hasPhoto && !removePhoto && !photo && (
              <div className="existing-photo">
                <img
                  src={`/api/cameras/${initial.id}/photo`}
                  alt="Saved camera reference"
                />
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => setRemovePhoto(true)}
                >
                  Remove saved photo
                </button>
              </div>
            )}
            <PhotoEditor
              onChange={(p) => {
                setPhoto(p);
                setPhotoConfirmed(false);
              }}
              onError={setError}
            />
            {photo && (
              <label className="check-label">
                <input
                  type="checkbox"
                  required
                  checked={photoConfirmed}
                  onChange={(e) => setPhotoConfirmed(e.target.checked)}
                />
                I have reviewed this image. No identifiable people, number
                plates, screens or private information remain.
              </label>
            )}
            <p className="help">
              The saved copy is resized and metadata is removed. Do not
              photograph footage.
            </p>
          </fieldset>
          <label className="check-label final-check">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I have checked this is a public-facing business or public
              authority camera. It is not ANPR, a household camera or a
              doorbell. No personal information has been entered.
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy}>
            <Check size={18} />
            {busy ? "Saving…" : initial ? "Save changes" : "Save camera"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
