# Activate force-approved work-email verification

Status: implemented and tested with a simulated mail sender; not active in the demonstration. Nathan selected a force-approved sender later. Current `AUTH_MODE=password-test` allows password sign-in to unverified police-domain accounts. It is deliberately visible as unverified in account details. Do not call this MFA or verified identity.

1. Obtain the force-approved sender, mail provider and processor terms. Do not use a personal domain without approval. For Cloudflare Email Service, verify its sending domain, SPF/DKIM/DMARC, recipient policies and force mail-gateway acceptance. A different approved provider requires an equivalent server-only adapter.
2. Configure a restricted `EMAIL` sending binding and approved `EMAIL_FROM` sender. Never put API keys or mail credentials in browser code. The existing deployment script deliberately has no mail binding.
3. Change `AUTH_MODE` from `password-test` to `verified-email` in both `wrangler.jsonc` and `scripts/prepare-connector-deploy.mjs`. Add the approved binding/sender in both deployment paths. The server defaults to enforcement when the mode is absent; do not remove the mode before delivery works.
4. Keep owner email verification null until the owner enters the actual emailed code. Do not mark it verified through SQL. Revoke existing sessions on activation. Test with a nominated work mailbox; the user enters the code themselves. Check delivery failure, replay, expiry, account removal and password-change revocation before opening registration.
5. Update the privacy notice, processor record and assurance status to describe the actual mail provider and retention. Delivery metadata is additional account-related processing.

Prepared flow: correct password → mail challenge → one-use code → email_verified_at → session. Code lifetime 10 minutes; five verification attempts; one resend per minute; five messages per account/hour plus IP throttling. Code and challenge are hashed in the database. Expired challenges are removed by the scheduled cleanup. Password changes/recovery and account removal invalidate pending challenges.

Mailbox verification is one-time, not a second factor on every login. Force SSO, MFA, managed devices and leaver revocation remain the recommended operational controls.
