import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import app from "../worker/index.mjs";
import {
  credential,
  digest,
  canInvite,
  validPoliceEmail,
} from "../worker/accounts.mjs";
const password = "A secure test password 42!";
const origin = "https://example.test";
async function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync("migrations/0001.sql", "utf8"));
  db.exec(fs.readFileSync("migrations/0002-accounts.sql", "utf8"));
  db.exec(fs.readFileSync("migrations/0003-email-verification.sql", "utf8"));
  const wrapper = {
    prepare(sql) {
      let args = [];
      const q = {
        bind(...values) {
          args = values;
          return q;
        },
        async first() {
          return db.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: db.prepare(sql).all(...args) };
        },
        async run() {
          return db.prepare(sql).run(...args);
        },
      };
      return q;
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const stored = JSON.stringify(await credential(password));
  const env = {
    AUTH_MODE: "password-test",
    DB: wrapper,
    RATE_SECRET: "test",
    AUTH_CREDENTIAL: stored,
  };
  const ids = {};
  for (const role of ["user", "supervisor", "webmaster"]) {
    ids[role] = crypto.randomUUID();
    db.prepare(
      "INSERT INTO users(id,username,credential,recovery_hash,role,created_at) VALUES (?,?,?,?,?,?)",
    ).run(
      ids[role],
      role + "@test.police.uk",
      stored,
      await digest("initial-recovery-" + role),
      role,
      Date.now(),
    );
  }
  let ip = 0;
  const send = (path, method = "GET", body, auth = {}) =>
    app.fetch(
      new Request(origin + "/api" + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "CF-Connecting-IP": auth.ip || String(++ip),
          ...(auth.cookie
            ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
    );
  async function login(username) {
    const r = await send("/login", "POST", {
      username: username.includes("@")
        ? username
        : username + "@test.police.uk",
      password,
    });
    assert.equal(r.status, 200);
    const b = await r.json();
    return {
      cookie: r.headers.get("set-cookie").split(";")[0],
      csrf: b.csrf,
      user: b.user,
    };
  }
  return { db, env, send, login, ids };
}
const camera = {
  name: "Test shop",
  kind: "business",
  address: "10 High Street",
  lat: 50.81,
  lng: -0.37,
  publicFacingConfirmed: true,
};
test("server enforces user, supervisor and web master permissions", async () => {
  const { db, send, login } = await setup();
  const user = await login("user"),
    supervisor = await login("supervisor"),
    master = await login("webmaster");
  assert.equal((await send("/cameras")).status, 401);
  const added = await send("/cameras", "POST", camera, user);
  assert.equal(added.status, 201);
  const c = (await added.json()).camera;
  assert.equal(
    (await send("/cameras/" + c.id, "PUT", { ...camera, revision: 1 }, user))
      .status,
    403,
  );
  assert.equal(
    (await send("/cameras/" + c.id, "DELETE", { revision: 1 }, supervisor))
      .status,
    403,
  );
  assert.equal(
    (await send("/users", "GET", undefined, supervisor)).status,
    403,
  );
  assert.equal((await send("/audit", "GET", undefined, user)).status, 403);
  assert.equal(
    (await send("/invitations", "POST", { role: "user" }, user)).status,
    403,
  );
  assert.equal(
    (await send("/invitations", "POST", { role: "webmaster" }, supervisor))
      .status,
    403,
  );
  assert.equal(
    (
      await send(
        "/cameras/" + c.id + "/verify",
        "POST",
        { revision: 1, confirmed: true },
        user,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await send(
        "/cameras/" + c.id,
        "PUT",
        { ...camera, revision: 2 },
        supervisor,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await send(
        "/cameras/bulk",
        "POST",
        {
          items: [{ id: c.id, revision: 3 }],
          action: "verify",
          confirmed: true,
        },
        supervisor,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await send(
        "/cameras/bulk",
        "POST",
        {
          items: [{ id: c.id, revision: 3 }],
          action: "verify",
          confirmed: true,
        },
        master,
      )
    ).status,
    200,
  );
  assert.equal(
    (await send("/cameras/" + c.id, "DELETE", { revision: 4 }, master)).status,
    200,
  );
  const audit = (await (await send("/audit", "GET", undefined, master)).json())
    .events;
  assert.ok(
    audit.some(
      (e) => e.action === "camera.verify" && e.actor_id === user.user.id,
    ),
  );
  assert.ok(audit.some((e) => e.status === 403));
  db.close();
});
test("single-use invitation assigns the issued role, never a submitted role, and supports recovery", async () => {
  const { db, send, login } = await setup(),
    supervisor = await login("supervisor");
  const r = await send("/invitations", "POST", { role: "user" }, supervisor);
  assert.equal(r.status, 201);
  const invite = await r.json(),
    token = invite.url.split("#invite=")[1];
  const b = {
    username: "new-user@test.police.uk",
    password,
    token,
    role: "webmaster",
  };
  const reg = await send("/register", "POST", b);
  assert.equal(reg.status, 200);
  const { recovery } = await reg.json();
  assert.equal(
    db
      .prepare("SELECT role FROM users WHERE username=?")
      .get("new-user@test.police.uk").role,
    "user",
  );
  assert.equal(
    (
      await send("/register", "POST", {
        ...b,
        username: "replay@test.police.uk",
      })
    ).status,
    400,
  );
  const auth = await login("new-user@test.police.uk");
  assert.equal(
    (
      await send("/recover", "POST", {
        username: "new-user@test.police.uk",
        password: "A replacement password 42!",
        recovery,
      })
    ).status,
    200,
  );
  assert.equal((await send("/session", "GET", undefined, auth)).status, 401);
  assert.equal(
    (
      await send("/recover", "POST", {
        username: "new-user@test.police.uk",
        password,
        recovery,
      })
    ).status,
    400,
  );
  db.close();
});
test("account removal and role changes revoke sessions and pending invitations; owner cannot remove self", async () => {
  const { db, send, login, ids } = await setup(),
    master = await login("webmaster"),
    supervisor = await login("supervisor");
  const inv = await (
    await send("/invitations", "POST", { role: "user" }, supervisor)
  ).json();
  assert.equal(
    (await send("/users/" + ids.webmaster, "DELETE", undefined, master)).status,
    400,
  );
  assert.equal(
    (await send("/users/" + ids.supervisor, "PUT", { role: "user" }, master))
      .status,
    200,
  );
  assert.equal(
    (await send("/session", "GET", undefined, supervisor)).status,
    401,
  );
  assert.equal(
    (
      await send("/register", "POST", {
        username: "blocked@test.police.uk",
        password,
        token: inv.url.split("#invite=")[1],
      })
    ).status,
    400,
  );
  assert.equal(
    (await send("/users/" + ids.supervisor, "DELETE", undefined, master))
      .status,
    200,
  );
  assert.equal(
    (
      await send("/login", "POST", {
        username: "supervisor@test.police.uk",
        password,
      })
    ).status,
    401,
  );
  db.close();
});
test("bulk actions reject stale revisions without partially updating other cameras", async () => {
  const { db, send, login } = await setup(),
    master = await login("webmaster");
  const a = (await (await send("/cameras", "POST", camera, master)).json())
      .camera,
    b = (await (await send("/cameras", "POST", camera, master)).json()).camera;
  const r = await send(
    "/cameras/bulk",
    "POST",
    {
      action: "delete",
      confirmed: true,
      items: [
        { id: a.id, revision: 1 },
        { id: b.id, revision: 999 },
      ],
    },
    master,
  );
  assert.equal(r.status, 409);
  assert.equal(db.prepare("SELECT count(*) AS n FROM cameras").get().n, 2);
  db.close();
});
test("invitation authority is explicit", () => {
  assert.equal(canInvite("supervisor", "user"), true);
  assert.equal(canInvite("supervisor", "supervisor"), false);
  assert.equal(canInvite("user", "user"), false);
  assert.equal(canInvite("webmaster", "webmaster"), true);
});

test("police email suffix restriction rejects lookalikes and non-police accounts", () => {
  for (const email of ["nathan.tracey@sussex.police.uk", "NAME@TEST.POLICE.UK"])
    assert.equal(validPoliceEmail(email), true);
  for (const email of [
    "nathan",
    "n@testpolice.uk",
    "n@sussex.police.uk.evil.com",
    "n@gmail.com",
    "n@-sussex.police.uk",
    "n@@sussex.police.uk",
    "n..t@sussex.police.uk",
  ])
    assert.equal(validPoliceEmail(email), false);
});
test("verification is fail-closed without sender; single-use code proves mailbox before session", async () => {
  const { db, env, send, ids } = await setup();
  delete env.AUTH_MODE;
  assert.equal(
    (
      await send("/login", "POST", {
        username: "user@test.police.uk",
        password,
      })
    ).status,
    503,
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM sessions").get().n, 0);
  let message;
  env.EMAIL_FROM = "test@example.invalid";
  env.EMAIL = {
    send: async (m) => {
      message = m;
    },
  };
  const r = await send("/login", "POST", {
    username: "user@test.police.uk",
    password,
  });
  const b = await r.json();
  assert.equal(b.verificationRequired, true);
  assert.equal(r.headers.get("set-cookie"), null);
  const code = message.text.match(/code is ([A-F0-9]{8})/)[1];
  assert.equal(message.to, "user@test.police.uk");
  assert.notEqual(
    db.prepare("SELECT code_hash FROM email_challenges").get().code_hash,
    code,
  );
  assert.equal(
    (
      await send("/verify-email", "POST", {
        challenge: b.challenge,
        code: "ZZZZZZZZ",
      })
    ).status,
    400,
  );
  const verified = await send("/verify-email", "POST", {
    challenge: b.challenge,
    code,
  });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).user.emailVerified, true);
  assert.ok(
    db.prepare("SELECT email_verified_at FROM users WHERE id=?").get(ids.user)
      .email_verified_at,
  );
  assert.equal(
    (await send("/verify-email", "POST", { challenge: b.challenge, code }))
      .status,
    400,
  );
});
test("expired or exhausted verification codes and sender failures grant no access", async () => {
  const { db, env, send } = await setup();
  delete env.AUTH_MODE;
  env.EMAIL_FROM = "test@example.invalid";
  env.EMAIL = {
    send: async () => {
      throw Error("delivery failure");
    },
  };
  assert.equal(
    (
      await send("/login", "POST", {
        username: "user@test.police.uk",
        password,
      })
    ).status,
    503,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM email_challenges").get().n,
    0,
  );
  let code;
  env.EMAIL.send = async (m) => {
    code = m.text.match(/code is ([A-F0-9]{8})/)[1];
  };
  const b = await (
    await send("/login", "POST", { username: "user@test.police.uk", password })
  ).json();
  db.prepare("UPDATE email_challenges SET expires=0").run();
  assert.equal(
    (await send("/verify-email", "POST", { challenge: b.challenge, code }))
      .status,
    400,
  );
  db.prepare("UPDATE email_challenges SET expires=?,attempts=5").run(
    Date.now() + 600000,
  );
  assert.equal(
    (await send("/verify-email", "POST", { challenge: b.challenge, code }))
      .status,
    400,
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM sessions").get().n, 0);
});
