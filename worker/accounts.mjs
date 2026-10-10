const encoder = new TextEncoder();
export const hex = (b) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(
    "",
  );
export const randomToken = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async (s) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(s)));
const cookie = (token, seconds = 28800) =>
  `__Host-cctv=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
export const publicUser = (u) => ({
  id: u.user_id || u.id,
  username: u.username,
  role: u.role,
  emailVerified: !!u.email_verified_at,
});
export const canManage = (role) =>
  role === "supervisor" || role === "webmaster";
export const validRole = (role) =>
  ["user", "supervisor", "webmaster"].includes(role);
export const canInvite = (actor, role) =>
  validRole(role) &&
  (actor === "webmaster" || (actor === "supervisor" && role === "user"));
export function validPoliceEmail(value) {
  if (typeof value !== "string" || value.length > 254) return false;
  const parts = value.split("@");
  return (
    parts.length === 2 &&
    parts[0].length <= 64 &&
    /^[a-z0-9]+(?:[._+\-][a-z0-9]+)*$/i.test(parts[0]) &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+police\.uk$/i.test(parts[1])
  );
}
export function checkPassword(p) {
  if (typeof p !== "string" || p.length < 14 || p.length > 200)
    throw Error("Use a password of 14–200 characters.");
}
export async function credential(password, salt = randomToken()) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return {
    salt,
    hash: hex(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: encoder.encode(salt),
          iterations: 100000,
          hash: "SHA-256",
        },
        key,
        256,
      ),
    ),
  };
}
export async function verify(password, stored) {
  if (typeof password !== "string" || password.length > 200) return false;
  const c = JSON.parse(stored),
    actual = await credential(password, c.salt);
  let diff = actual.hash.length ^ c.hash.length;
  for (let i = 0; i < actual.hash.length; i++)
    diff |= actual.hash.charCodeAt(i) ^ c.hash.charCodeAt(i);
  return diff === 0;
}
export const log = (env, action, actor = null, target = null, status = 200) =>
  env.DB.prepare(
    "INSERT INTO audit(action,actor_id,camera_id,at,status) VALUES (?,?,?,?,?)",
  ).bind(action, actor, target, Date.now(), status);
const guard = (env) =>
  env.DB.prepare(
    "SELECT CASE WHEN changes()=0 THEN json('conflict') ELSE 1 END",
  );
export async function throttle(req, env) {
  const now = Date.now(),
    key = await digest(
      env.RATE_SECRET +
        "|account|" +
        (req.headers.get("CF-Connecting-IP") || "local") +
        "|" +
        Math.floor(now / 900000),
    );
  const row = await env.DB.prepare(
    "INSERT INTO login_limits(key,attempts,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
  )
    .bind(key, now + 900000)
    .first();
  return row.attempts <= 8;
}
export async function login(req, env, json, payload) {
  if (!(await throttle(req, env)))
    return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  const b = await payload(req, 4096),
    username =
      typeof b.username === "string" ? b.username.toLowerCase().trim() : "";
  const u = validPoliceEmail(username)
    ? await env.DB.prepare("SELECT * FROM users WHERE username=? AND active=1")
        .bind(username)
        .first()
    : null;
  const ok = await verify(b.password, u?.credential || env.AUTH_CREDENTIAL);
  if (!u || !ok) {
    await log(env, "login.failed", null, null, 401).run();
    return json({ error: "Account or password not recognised." }, 401);
  }
  if (env.AUTH_MODE !== "password-test" && !u.email_verified_at)
    return startEmailVerification(u, env, json);
  return createSession(u, env, json);
}
async function createSession(u, env, json) {
  const token = randomToken(),
    csrf = randomToken(),
    now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO sessions(token_hash,csrf,expires,last_seen,user_id) VALUES (?,?,?,?,?)",
    ).bind(await digest(token), csrf, now + 28800000, now, u.id),
    log(env, "login.success", u.id),
  ]);
  return json({ csrf, user: publicUser(u) }, 200, {
    "Set-Cookie": cookie(token),
  });
}
export async function session(req, env) {
  const token = req.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)__Host-cctv=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  const key = await digest(token),
    now = Date.now();
  const s = await env.DB.prepare(
    "SELECT sessions.*,users.username,users.role,users.email_verified_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>? AND last_seen>? AND users.active=1",
  )
    .bind(key, now, now - 1800000)
    .first();
  if (
    s &&
    (!validPoliceEmail(s.username) ||
      (env.AUTH_MODE !== "password-test" && !s.email_verified_at))
  )
    return null;
  if (s)
    await env.DB.prepare("UPDATE sessions SET last_seen=? WHERE token_hash=?")
      .bind(now, key)
      .run();
  return s;
}
async function startEmailVerification(u, env, json) {
  if (!env.EMAIL || !env.EMAIL_FROM)
    return json(
      {
        error:
          "Work-email verification awaits an approved sender. Access has not been granted.",
      },
      503,
    );
  const now = Date.now();
  const recent = await env.DB.prepare(
    "SELECT created_at FROM email_challenges WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(u.id)
    .first();
  if (recent && now - recent.created_at < 60000)
    return json(
      {
        error: "Wait one minute before requesting another verification email.",
      },
      429,
    );
  const rate = await env.DB.prepare(
    "INSERT INTO login_limits(key,attempts,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
  )
    .bind("verify-" + u.id + "-" + Math.floor(now / 3600000), now + 3600000)
    .first();
  if (rate.attempts > 5)
    return json(
      { error: "Verification email limit reached. Try again in one hour." },
      429,
    );
  const token = randomToken(),
    code = randomToken().slice(0, 8).toUpperCase(),
    key = await digest(token);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM email_challenges WHERE user_id=?").bind(u.id),
    env.DB.prepare(
      "INSERT INTO email_challenges(token_hash,user_id,code_hash,expires,created_at) VALUES (?,?,?,?,?)",
    ).bind(key, u.id, await digest(token + ":" + code), now + 600000, now),
  ]);
  try {
    await env.EMAIL.send({
      to: u.username,
      from: { email: env.EMAIL_FROM, name: "CCTV Enquiries" },
      subject: "Verify your CCTV Enquiries work email",
      text:
        "Your verification code is " +
        code +
        ". It expires in 10 minutes. Enter it only in the CCTV Enquiries sign-in screen where you requested it. If you did not request this, ignore this email. No camera or investigation information is included.",
      html:
        "<p>Your CCTV Enquiries verification code is <strong>" +
        code +
        "</strong>.</p><p>Expires in 10 minutes. Enter it only in the sign-in screen where you requested it. If you did not request this, ignore this email.</p>",
    });
  } catch {
    await env.DB.prepare("DELETE FROM email_challenges WHERE token_hash=?")
      .bind(key)
      .run();
    return json(
      {
        error:
          "Verification email could not be sent. Access has not been granted. Contact the administrator.",
      },
      503,
    );
  }
  await log(env, "email.verification.sent", u.id).run();
  return json({ verificationRequired: true, challenge: token });
}
export async function verifyEmail(req, env, json, payload) {
  if (!(await throttle(req, env)))
    return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  const b = await payload(req, 2048);
  if (
    typeof b.challenge !== "string" ||
    !/^[a-f0-9]{64}$/.test(b.challenge) ||
    typeof b.code !== "string" ||
    !/^[a-f0-9]{8}$/i.test(b.code.trim())
  )
    return json(
      { error: "Enter the eight-character code from your work email." },
      400,
    );
  const key = await digest(b.challenge),
    now = Date.now();
  const challenge = await env.DB.prepare(
    "UPDATE email_challenges SET attempts=attempts+1 WHERE token_hash=? AND expires>? AND attempts<5 RETURNING *",
  )
    .bind(key, now)
    .first();
  if (
    !challenge ||
    challenge.code_hash !==
      (await digest(b.challenge + ":" + b.code.trim().toUpperCase()))
  )
    return json(
      {
        error:
          "Code incorrect or expired. Sign in again to request a new code.",
      },
      400,
    );
  const u = await env.DB.prepare("SELECT * FROM users WHERE id=? AND active=1")
    .bind(challenge.user_id)
    .first();
  if (!u || !validPoliceEmail(u.username))
    return json({ error: "Account unavailable." }, 403);
  const claimed = await env.DB.prepare(
    "DELETE FROM email_challenges WHERE token_hash=? RETURNING token_hash",
  )
    .bind(key)
    .first();
  if (!claimed)
    return json({ error: "Code already used. Sign in again." }, 400);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET email_verified_at=? WHERE id=?").bind(
      now,
      u.id,
    ),
    log(env, "email.verified", u.id),
  ]);
  return createSession({ ...u, email_verified_at: now }, env, json);
}
export async function publicAccounts(req, env, path, json, payload) {
  if (
    !["/api/register", "/api/recover"].includes(path) ||
    req.method !== "POST"
  )
    return null;
  if (!(await throttle(req, env)))
    return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  const b = await payload(req, 4096);
  checkPassword(b.password);
  const username =
    typeof b.username === "string" ? b.username.trim().toLowerCase() : "";
  if (!validPoliceEmail(username))
    return json(
      {
        error: "Use your force email address ending in .police.uk.",
      },
      400,
    );
  const recovery = randomToken(),
    stored = JSON.stringify(await credential(b.password));
  if (path === "/api/register") {
    if (typeof b.token !== "string" || !/^[a-f0-9]{64}$/.test(b.token))
      return json({ error: "Invalid invitation." }, 400);
    const invite = await env.DB.prepare(
      "SELECT i.* FROM invitations i JOIN users u ON u.id=i.created_by WHERE token_hash=? AND revoked=0 AND used_at IS NULL AND expires>? AND u.active=1 AND (u.role='webmaster' OR (u.role='supervisor' AND i.role='user'))",
    )
      .bind(await digest(b.token), Date.now())
      .first();
    if (!invite)
      return json(
        { error: "Invitation expired, revoked or already used." },
        400,
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE invitations SET used_at=? WHERE id=? AND used_at IS NULL AND revoked=0 AND expires>?",
      ).bind(Date.now(), invite.id, Date.now()),
      guard(env),
      env.DB.prepare(
        "INSERT INTO users(id,username,credential,recovery_hash,role,created_at) VALUES (?,?,?,?,?,?)",
      ).bind(
        id,
        username,
        stored,
        await digest(recovery),
        invite.role,
        Date.now(),
      ),
      log(env, "account.registered", id, invite.id),
    ]);
  } else {
    const u = await env.DB.prepare(
      "SELECT id,recovery_hash FROM users WHERE username=? AND active=1",
    )
      .bind(username)
      .first();
    if (
      !u ||
      typeof b.recovery !== "string" ||
      (await digest(b.recovery)) !== u.recovery_hash
    ) {
      await log(env, "recovery.failed", null, null, 400).run();
      return json({ error: "Account or recovery code not recognised." }, 400);
    }
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET credential=?,recovery_hash=? WHERE id=? AND recovery_hash=? AND active=1",
      ).bind(stored, await digest(recovery), u.id, u.recovery_hash),
      guard(env),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(u.id),
      env.DB.prepare("DELETE FROM email_challenges WHERE user_id=?").bind(u.id),
      log(env, "password.recovered", u.id),
    ]);
  }
  return json({ ok: true, recovery }, 200, { "Set-Cookie": cookie("", 0) });
}
export async function accountRoutes(req, env, path, s, json, payload) {
  if (path === "/api/account/password" && req.method === "POST") {
    const b = await payload(req, 4096);
    checkPassword(b.password);
    if (!(await throttle(req, env)))
      return json({ error: "Too many attempts. Try again later." }, 429);
    const u = await env.DB.prepare("SELECT credential FROM users WHERE id=?")
      .bind(s.user_id)
      .first();
    if (!(await verify(b.currentPassword, u.credential)))
      return json({ error: "Current password not recognised." }, 400);
    const recovery = randomToken();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET credential=?,recovery_hash=? WHERE id=? AND credential=?",
      ).bind(
        JSON.stringify(await credential(b.password)),
        await digest(recovery),
        s.user_id,
        u.credential,
      ),
      guard(env),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(s.user_id),
      env.DB.prepare("DELETE FROM email_challenges WHERE user_id=?").bind(
        s.user_id,
      ),
      log(env, "password.changed", s.user_id),
    ]);
    return json({ ok: true, recovery }, 200, { "Set-Cookie": cookie("", 0) });
  }
  if (path === "/api/invitations") {
    if (!canManage(s.role))
      return json({ error: "Supervisor or web master access required." }, 403);
    if (req.method === "GET")
      return json({
        invitations: (
          await env.DB.prepare(
            "SELECT id,role,created_by,expires,used_at,revoked FROM invitations WHERE (?='webmaster' OR created_by=?) ORDER BY expires DESC LIMIT 100",
          )
            .bind(s.role, s.user_id)
            .all()
        ).results,
      });
    if (req.method === "POST") {
      const b = await payload(req, 2048);
      if (!canInvite(s.role, b.role))
        return json({ error: "Supervisors may invite users only." }, 403);
      const count = await env.DB.prepare(
        "SELECT count(*) AS n FROM invitations WHERE created_by=? AND expires>? AND used_at IS NULL AND revoked=0",
      )
        .bind(s.user_id, Date.now())
        .first();
      if (count.n >= 20)
        return json(
          { error: "Revoke or use existing invitations before creating more." },
          429,
        );
      const token = randomToken(),
        id = crypto.randomUUID(),
        expires = Date.now() + 86400000;
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO invitations(id,token_hash,role,created_by,expires) VALUES (?,?,?,?,?)",
        ).bind(id, await digest(token), b.role, s.user_id, expires),
        log(env, "invitation.created", s.user_id, id),
      ]);
      return json(
        { id, expires, url: new URL(req.url).origin + "/#invite=" + token },
        201,
      );
    }
  }
  const inv = path.match(/^\/api\/invitations\/([a-f0-9-]+)$/);
  if (inv && req.method === "DELETE") {
    if (!canManage(s.role)) return json({ error: "Access denied." }, 403);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE invitations SET revoked=1 WHERE id=? AND (?='webmaster' OR created_by=?)",
      ).bind(inv[1], s.role, s.user_id),
      log(env, "invitation.revoked", s.user_id, inv[1]),
    ]);
    return json({ ok: true });
  }
  if (path === "/api/users" && req.method === "GET") {
    if (s.role !== "webmaster")
      return json({ error: "Web master access required." }, 403);
    return json({
      users: (
        await env.DB.prepare(
          "SELECT id,username,role,active,created_at FROM users ORDER BY created_at",
        ).all()
      ).results,
    });
  }
  const user = path.match(/^\/api\/users\/([a-f0-9-]+)$/);
  if (user && ["PUT", "DELETE"].includes(req.method)) {
    if (s.role !== "webmaster")
      return json({ error: "Web master access required." }, 403);
    if (user[1] === s.user_id)
      return json(
        { error: "You cannot remove or change your own web master access." },
        400,
      );
    const b = req.method === "PUT" ? await payload(req, 2048) : {};
    if (req.method === "PUT" && !validRole(b.role))
      return json({ error: "Choose a valid role." }, 400);
    await env.DB.batch([
      req.method === "DELETE"
        ? env.DB.prepare(
            "UPDATE users SET active=0,username=?,credential='',recovery_hash='' WHERE id=?",
          ).bind("removed-" + user[1], user[1])
        : env.DB.prepare(
            "UPDATE users SET role=? WHERE id=? AND active=1",
          ).bind(b.role, user[1]),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user[1]),
      env.DB.prepare("DELETE FROM email_challenges WHERE user_id=?").bind(
        user[1],
      ),
      env.DB.prepare(
        "UPDATE invitations SET revoked=1 WHERE created_by=? AND used_at IS NULL",
      ).bind(user[1]),
      log(
        env,
        req.method === "DELETE" ? "account.removed" : `role.changed.${b.role}`,
        s.user_id,
        user[1],
      ),
    ]);
    return json({ ok: true });
  }
  if (path === "/api/audit" && req.method === "GET") {
    if (s.role !== "webmaster")
      return json({ error: "Web master access required." }, 403);
    const before =
      Number(new URL(req.url).searchParams.get("before")) ||
      Number.MAX_SAFE_INTEGER;
    return json({
      events: (
        await env.DB.prepare(
          "SELECT * FROM audit WHERE id<? ORDER BY id DESC LIMIT 100",
        )
          .bind(before)
          .all()
      ).results,
    });
  }
  return null;
}
