import { useEffect, useState } from "react";
import { api } from "./api";
import Modal from "./Modal";
import type { CameraRecord } from "./domain";
export type Account = {
  id: string;
  username: string;
  emailVerified?: boolean;
  role: "user" | "supervisor" | "webmaster";
};
export const roleLabel = (r: string) =>
  ({ user: "User", supervisor: "Supervisor", webmaster: "Web master" })[r] || r;
export function Registration({ onClose }: { onClose: () => void }) {
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("invite") || "",
  );
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [recovery, setRecovery] = useState(""),
    [result, setResult] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (token) history.replaceState(null, "", location.pathname);
  }, [token]);
  return (
    <Modal
      title={token ? "Register with your invitation" : "Reset your password"}
      onClose={onClose}
    >
      <form
        className="policy-content account-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await api(token ? "/register" : "/recover", {
              method: "POST",
              body: JSON.stringify({ username, password, token, recovery }),
            });
            setResult(r.recovery);
            setPassword("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {result ? (
          <>
            <h3>Save your recovery code</h3>
            <p>
              This replaces any previous recovery code. Store it in your
              approved password manager. It is only shown once and lets you
              reset your password.
            </p>
            <code className="secret-code">{result}</code>
            <button type="button" className="primary" onClick={onClose}>
              I have saved it — sign in
            </button>
          </>
        ) : (
          <>
            <p>
              Use your force email address ending in .police.uk. Invitations
              expire after 24 hours and can be used once.
            </p>
            <label>
              Police email address
              <input
                required
                type="email"
                autoComplete="username"
                placeholder="name@force.police.uk"
                minLength={3}
                maxLength={254}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            {!token && (
              <label>
                Recovery code
                <input
                  required
                  autoComplete="off"
                  value={recovery}
                  onChange={(e) => setRecovery(e.target.value)}
                />
              </label>
            )}
            <label>
              New password (at least 14 characters)
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={14}
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Working…" : token ? "Create account" : "Reset password"}
            </button>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
export default function Access({
  user,
  cameras,
  onRefresh,
  onClose,
}: {
  user: Account;
  cameras: CameraRecord[];
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("account"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [users, setUsers] = useState<any[]>([]),
    [invites, setInvites] = useState<any[]>([]),
    [events, setEvents] = useState<any[]>([]),
    [inviteRole, setInviteRole] = useState("user"),
    [inviteURL, setInviteURL] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [password, setPassword] = useState(""),
    [recovery, setRecovery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [action, setAction] = useState("verify"),
    [retention, setRetention] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [notice, setNotice] = useState("");
  const manager = user.role !== "user",
    master = user.role === "webmaster";
  async function load() {
    if (tab === "users") setUsers((await api("/users")).users);
    if (tab === "invites") setInvites((await api("/invitations")).invitations);
    if (tab === "audit") setEvents((await api("/audit")).events);
  }
  useEffect(() => {
    setError("");
    load().catch((e) => setError(e.message));
  }, [tab]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Account & administration"
      subtitle={`${user.username} · ${roleLabel(user.role)} · ${user.emailVerified ? "work email verified" : "work email not yet verified"}`}
      onClose={onClose}
      wide
    >
      <div className="policy-content admin-content">
        <div
          className="admin-tabs"
          role="tablist"
          aria-label="Administration sections"
        >
          {[
            ["account", "My account"],
            ...(manager ? [["invites", "Invitations"]] : []),
            ...(master
              ? [
                  ["users", "Users"],
                  ["bulk", "Multiple cameras"],
                  ["audit", "Event log"],
                ]
              : []),
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "primary" : "secondary"}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {tab === "account" && (
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await api("/account/password", {
                  method: "POST",
                  body: JSON.stringify({ currentPassword, password }),
                });
                setRecovery(r.recovery);
                setCurrentPassword("");
                setPassword("");
              });
            }}
          >
            <p>
              Each account has its own permissions. Recovery codes replace
              email-based password resets. Your police email is stored for
              account access only.
            </p>
            {recovery ? (
              <>
                <h3>Save your new recovery code</h3>
                <code className="secret-code">{recovery}</code>
                <p>
                  Your sessions have been revoked. Save this code before signing
                  in again.
                </p>
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    window.dispatchEvent(new Event("session-expired"))
                  }
                >
                  Saved — sign in again
                </button>
              </>
            ) : (
              <>
                <label>
                  Current password
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={14}
                    maxLength={200}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Change password & recovery code
                </button>
              </>
            )}
          </form>
        )}
        {tab === "invites" && (
          <>
            <h3>Invite a colleague</h3>
            <p>
              Create a single-use registration link, then send it through your
              approved email account. Whoever receives the link can claim its
              role; check the recipient carefully. Email delivery is not
              automatic.
            </p>
            <div className="button-row">
              <select
                aria-label="Invitation role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {(master ? ["user", "supervisor", "webmaster"] : ["user"]).map(
                  (r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ),
                )}
              </select>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await api("/invitations", {
                      method: "POST",
                      body: JSON.stringify({ role: inviteRole }),
                    });
                    setInviteURL(r.url);
                    await load();
                  })
                }
              >
                Create invitation
              </button>
            </div>
            {inviteURL && (
              <div className="info-box invite-box">
                <label>
                  Invitation link — expires in 24 hours
                  <input readOnly value={inviteURL} />
                </label>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() =>
                      run(async () => {
                        await navigator.clipboard.writeText(inviteURL);
                        setNotice("Invitation copied.");
                      })
                    }
                  >
                    Copy invitation
                  </button>
                  <a
                    className="primary"
                    href={
                      "mailto:?subject=" +
                      encodeURIComponent(
                        "CCTV Enquiries — registration invitation",
                      ) +
                      "&body=" +
                      encodeURIComponent(
                        "You have been invited to the CCTV Enquiries test workspace. This single-use link expires after 24 hours. Do not forward it.\n\n" +
                          inviteURL +
                          "\n\nUse your .police.uk email address and save your recovery code. This system is for controlled testing, not live investigations.",
                      )
                    }
                  >
                    Email invitation
                  </a>
                </div>
              </div>
            )}
            <h3>Invitations</h3>
            {invites.map((i) => (
              <div className="admin-row" key={i.id}>
                <span>
                  {roleLabel(i.role)} ·{" "}
                  {i.revoked
                    ? "Revoked"
                    : i.used_at
                      ? "Accepted"
                      : i.expires < Date.now()
                        ? "Expired"
                        : "Pending"}
                  <small>{new Date(i.expires).toLocaleString("en-GB")}</small>
                </span>
                {!i.revoked && !i.used_at && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api("/invitations/" + i.id, { method: "DELETE" });
                        await load();
                      })
                    }
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </>
        )}
        {tab === "users" && (
          <>
            <p>
              Role changes revoke current sessions and outstanding invitations.
              Removing access also removes the email address and password; the
              opaque account ID remains in the event log.
            </p>
            {users.map((u) => (
              <div className="admin-row" key={u.id}>
                <span>
                  <strong>{u.active ? u.username : "Removed account"}</strong>
                  <small>{u.id}</small>
                </span>
                {!!u.active && (
                  <>
                    <select
                      aria-label={"Role for " + u.username}
                      disabled={busy || u.id === user.id}
                      value={u.role}
                      onChange={(e) => {
                        const role = e.target.value;
                        run(async () => {
                          await api("/users/" + u.id, {
                            method: "PUT",
                            body: JSON.stringify({ role }),
                          });
                          await load();
                        });
                      }}
                    >
                      {["user", "supervisor", "webmaster"].map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary"
                      disabled={busy || u.id === user.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Remove access for " +
                              u.username +
                              "? Current sessions and outstanding invitations will be revoked.",
                          )
                        )
                          run(async () => {
                            await api("/users/" + u.id, { method: "DELETE" });
                            await load();
                          });
                      }}
                    >
                      Remove access
                    </button>
                  </>
                )}
              </div>
            ))}
          </>
        )}
        {tab === "bulk" && (
          <>
            <p>
              Select up to 50 cameras. All changes are applied together; if any
              camera has changed, refresh and review the selection.
            </p>
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => {
                  setSelected(cameras.slice(0, 50).map((c) => c.id));
                  setConfirmed(false);
                }}
              >
                Select first 50
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setSelected([]);
                  setConfirmed(false);
                }}
              >
                Clear selection
              </button>
              <strong>{selected.length} selected</strong>
            </div>
            <div className="bulk-list">
              {cameras.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    disabled={!selected.includes(c.id) && selected.length >= 50}
                    onChange={(e) => {
                      setSelected(
                        e.target.checked
                          ? [...selected, c.id]
                          : selected.filter((id) => id !== c.id),
                      );
                      setConfirmed(false);
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <label>
              Action
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="verify">Mark verified</option>
                <option value="unverify">Mark needs verification</option>
                <option value="retention">Update reported retention</option>
                <option value="delete">
                  Delete cameras and reference photos
                </option>
              </select>
            </label>
            {action === "retention" && (
              <label>
                Reported retention
                <select
                  value={retention}
                  onChange={(e) => {
                    setRetention(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="">Unknown</option>
                  {[1, 3, 7, 14, 28, 30, 60, 90].map((n) => (
                    <option key={n} value={n}>
                      {n} days
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="confirm-row">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I have reviewed these {selected.length} cameras and confirm this
              action
              {action === "delete"
                ? ", including permanent removal from the active register"
                : ""}
              .
            </label>
            <button
              className={action === "delete" ? "danger" : "primary"}
              disabled={busy || !confirmed || !selected.length}
              onClick={() =>
                run(async () => {
                  const items = selected.map((id) => ({
                    id,
                    revision: cameras.find((c) => c.id === id)!.revision,
                  }));
                  const r = await api("/cameras/bulk", {
                    method: "POST",
                    body: JSON.stringify({
                      items,
                      action,
                      confirmed,
                      retentionDays: retention ? Number(retention) : null,
                    }),
                  });
                  setNotice(`Updated ${r.count} cameras.`);
                  setSelected([]);
                  setConfirmed(false);
                  onRefresh();
                })
              }
            >
              Apply to {selected.length} cameras
            </button>
          </>
        )}
        {tab === "audit" && (
          <>
            <p>
              Application events, newest first. Includes account actions, API
              requests, camera changes and recorded route/export actions.
              Retained for 14 days. This is not a tamper-proof infrastructure
              log; browser-only events depend on successful delivery.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => run(load)}
            >
              Refresh log
            </button>
            <div className="audit-table">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Account ID</th>
                    <th>Target ID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.at).toLocaleString("en-GB")}</td>
                      <td>{e.action}</td>
                      <td>{e.actor_id || "Unauthenticated / legacy"}</td>
                      <td>{e.camera_id || "—"}</td>
                      <td>{e.status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {events.length > 0 && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await api(
                      "/audit?before=" + events[events.length - 1].id,
                    );
                    setEvents([...events, ...r.events]);
                    if (!r.events.length) setNotice("No older events.");
                  })
                }
              >
                Load older events
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
