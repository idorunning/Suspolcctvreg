import fs from "node:fs";
import { credential, digest, randomToken } from "../worker/accounts.mjs";
fs.mkdirSync("private", { recursive: true });
if (fs.existsSync("private/admin-access.json"))
  throw Error("Owner credentials already exist. Do not overwrite them.");
const password = "CCTV-" + randomToken().slice(0, 24),
  recovery = randomToken(),
  id = crypto.randomUUID();
const data = { id, username: "nathan", password, recovery, role: "webmaster" };
fs.writeFileSync("private/admin-access.json", JSON.stringify(data, null, 2), {
  mode: 0o600,
});
fs.writeFileSync(
  "private/owner-query.json",
  JSON.stringify({
    sql: "INSERT INTO users(id,username,credential,recovery_hash,role,created_at) VALUES (?,?,?,?,?,?)",
    params: [
      id,
      data.username,
      JSON.stringify(await credential(password)),
      await digest(recovery),
      "webmaster",
      String(Date.now()),
    ],
  }),
  { mode: 0o600 },
);
console.log(
  "Prepared private owner credentials and parameterised database insert. No credentials are committed.",
);
