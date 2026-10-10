// Local development only. Never overwrite a production credential with this helper.
import fs from "node:fs";
import crypto from "node:crypto";
if (fs.existsSync(".dev.vars") || fs.existsSync("private/access.json"))
  throw new Error(
    "Local access files already exist. Move them aside deliberately before generating a different local password.",
  );
const password = "CCTV-" + crypto.randomBytes(12).toString("base64url");
const salt = crypto.randomBytes(16).toString("hex");
const credential = JSON.stringify({
  salt,
  hash: crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex"),
});
const rateSecret = crypto.randomBytes(32).toString("hex");
fs.mkdirSync("private", { recursive: true });
fs.writeFileSync(
  "private/access.json",
  JSON.stringify({ password, credential, rateSecret }),
  { mode: 0o600 },
);
fs.writeFileSync(
  ".dev.vars",
  `AUTH_CREDENTIAL='${credential}'\nRATE_SECRET='${rateSecret}'\n`,
  { mode: 0o600 },
);
console.log(
  "Local test access created in ignored private files. No credential was printed.",
);
