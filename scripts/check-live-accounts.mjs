import assert from "node:assert/strict";
import fs from "node:fs";
const base = "https://suspol-cctv-test.ntracey.workers.dev",
  owner = JSON.parse(fs.readFileSync("private/admin-access.json", "utf8"));
const results = [];
let master = null,
  user = null,
  invitation = null,
  userId = null;
async function request(path, method = "GET", body, auth) {
  return fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
}
async function login(username, password) {
  const r = await request("/login", "POST", { username, password });
  assert.equal(r.status, 200);
  const body = await r.json();
  return { cookie: r.headers.get("set-cookie").split(";")[0], ...body };
}
try {
  master = await login(owner.username, owner.password);
  assert.equal(master.user.role, "webmaster");
  results.push("Nathan has web master access");
  const made = await request("/invitations", "POST", { role: "user" }, master);
  assert.equal(made.status, 201);
  invitation = await made.json();
  const username = "qa-" + crypto.randomUUID().slice(0, 8),
    password = crypto.randomUUID() + "-QA";
  const reg = await request("/register", "POST", {
    username,
    password,
    token: invitation.url.split("#invite=")[1],
    role: "webmaster",
  });
  assert.equal(reg.status, 200);
  assert.equal((await reg.json()).recovery.length, 64);
  user = await login(username, password);
  userId = user.user.id;
  assert.equal(user.user.role, "user");
  results.push("Single-use invite registers the issued user role");
  assert.equal((await request("/users", "GET", undefined, user)).status, 403);
  assert.equal((await request("/audit", "GET", undefined, user)).status, 403);
  assert.equal(
    (await request("/invitations", "POST", { role: "webmaster" }, user)).status,
    403,
  );
  assert.equal(
    (await request("/cameras/missing", "PUT", {}, user)).status,
    403,
  );
  results.push("User cannot access administration, invite or edit cameras");
  assert.equal(
    (await request("/users/" + userId, "DELETE", undefined, master)).status,
    200,
  );
  assert.equal((await request("/session", "GET", undefined, user)).status, 401);
  results.push("Removing the QA account immediately revokes its session");
  userId = null;
  const audit = await request("/audit", "GET", undefined, master);
  assert.equal(audit.status, 200);
  const events = (await audit.json()).events;
  assert.ok(events.some((e) => e.action === "account.removed"));
  assert.ok(events.some((e) => e.status === 403));
  results.push("Web master can read attributed events and denied requests");
} finally {
  if (userId && master)
    await request("/users/" + userId, "DELETE", undefined, master);
  if (invitation && master)
    await request("/invitations/" + invitation.id, "DELETE", undefined, master);
  if (master) await request("/logout", "POST", {}, master);
  fs.writeFileSync(
    "private/live-account-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
}
