# Operational readiness and data review

10 October 2026 · CCTV Enquiries v2.0 · England and Wales

## Decision

Use the deployed application as a restricted, non-operational test. Do not describe it as fully data-compliant, accredited, or guaranteed free of personal data. The application now has useful technical safeguards, but organisational approval, approved suppliers, force identity integration and independent assurance are outstanding.

Cloudflare was selected for the pilot because one Worker can enforce authentication for both the application API and photos, with D1 providing shared persistence for desktop and mobile. This avoids relying on a JavaScript-only password screen or incompatible shared-folder browser access. Netlify could also support a suitable architecture; this is not a claim that either host is automatically approved for policing.

The D1 database has EU jurisdiction and read replication disabled. Cloudflare returned an Eastern Europe primary region. Neither this nor the Worker deployment guarantees UK-only processing. The force must examine support access, subprocessors, logs, backups, transfers and contractual controls across the complete service.

## Data boundaries

| Data                                                    | Pilot treatment                                                                            | Remaining issue                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Public-facing business/public authority camera location | Authenticated database record                                                              | Public visibility does not make an aggregated register risk-free; validate accuracy and classification                               |
| Business name and premises address                      | Permitted subject to contributor confirmation                                              | Sole traders or home-based businesses can be identifiable individuals; exclude them where the zero-personal-content rule is required |
| Public telephone                                        | Organisation landline/non-geographic format, source URL and explicit confirmation          | A format check cannot determine ownership; independently verify it                                                                   |
| Police reference                                        | Camera asset reference only; no incident/crime/person references                           | If linkable to a person, it may remain personal data; decide the linking model with the DPO                                          |
| Officer names, emails, creator IDs                      | Not imported and not accepted by the camera API                                            | Future accountability should use force identity and approved audit arrangements, not unverified initials                             |
| ANPR, household cameras, doorbells, footage             | No supported category; no footage upload; prohibited in UI and validation                  | Human review is still needed to classify the actual camera                                                                           |
| Reference photos                                        | JPEG re-encoding, manual blackout tool, server metadata stripping, authenticated retrieval | No automated detection of faces, plates or private information. Add reviewer approval and/or approved scanning before wider use      |
| Investigation route                                     | In browser memory only; not saved to the application database                              | FOSSGIS receives and logs chosen coordinates after confirmation. Never submit operational routes to the demo provider                            |
| Device GPS                                              | Requested by explicit action, no background tracking                                       | Camera location is stored if the user saves it; check GPS accuracy and adjust the point                                              |
| Login/network metadata                                  | Essential session cookie, salted hashed throttle key; Worker application logging disabled  | Network providers may process IPs/technical data. A hashed network identifier can be pseudonymous personal data                      |
| Export/email                                            | Explicit confirmation; CSV download or draft in user's client                              | Organisation controls for downloads, mail recipients and downstream retention still apply                                            |

A reference replacing a name is not necessarily anonymous. The ICO distinguishes pseudonymisation from anonymisation. Part 3 of the Data Protection Act 2018 applies where a competent authority processes personal data for law-enforcement purposes; other purposes may fall under the UK GDPR regime. The force must determine the applicable regime for each activity. A privacy pop-up does not replace a lawful basis, a DPIA, or security accreditation.

## Source import

- 71 records in the supplied CSV; 58 retained as unverified camera candidates.
- 13 held out: three school-site entries pending public-facing scope review; two healthcare-site entries; two unnamed entries; two locations with unconfirmed ownership/public-facing scope; one ambiguous B&B; one sensitive residential site; one internal-only entry; one care-related site.
- Original creator emails/IDs, source IDs/timestamps and the ambiguous existing reference were excluded. No contact number was inferred. Every source address was blank.
- The original attachment is unchanged. Neither source data nor private seed SQL is committed to the public GitHub repository.
- Review every retained entry before any real enquiry. Multiple cameras at one business can be valid; clustering is a visual aggregation, not deduplication.

## Mapping and business data

**Current pilot:** OpenStreetMap tiles load only after the mapping notice is accepted; requests expose the viewed area and browser IP to the tile service. FOSSGIS routing (routing.openstreetmap.de) is separately enabled, sends all anchors via the Worker, and uses separate walking and driving graphs. The provider logs route requests. Keep operational routes off the public provider; a force-approved or locally hosted routing service remains a deployment requirement. Manual tracing makes no routing request. The public services' usage policies and availability limits apply.

**Business suggestions:** the optional Overpass action searches a 150-metre area for named shops and a short list of commercial amenities. Only location coordinates, not camera IDs or case narratives, are sent. Listings may pre-fill details, keep OpenStreetMap attribution and require confirmation before saving. A shop listing is not evidence of a camera. Nathan authorised sharing selected test coordinates with Overpass on 10 October 2026. The direct diagnostic returned 30 listings, but the deployed Worker received provider **HTTP 521**. An isolated trial of the documented browser request path also failed twice; it was removed and no extra browser connection permission was deployed. The website retains the server-mediated lookup and manual entry. The external failure cause is not established beyond the observed responses; this is not an authentication/plugin-reconnection problem. Lookup failures, malformed replies and incomplete results now return an explicit service-unavailable error, not a successful empty list.

**Lookup barrier and next action:** automatic business suggestions are not verified as working on the live site. Before relying on this feature, obtain an approved, supported gazetteer/business-data service or host an OSM extract on approved infrastructure, then verify the integration from that environment. Agree processor terms, permitted disclosures, data quality and licensing before changing destinations. Do not add unapproved proxy services or silently switch providers. Manual verification of premises and contacts remains necessary.

**Google Places:** it can supply business details, but its storage, caching, attribution and map-display restrictions apply. Do not scrape Google Maps or persist Places content indiscriminately into this Leaflet register. The present build contains no Google API key or Google Places import. If selected later, review the current contract and implement a permitted lookup/display design. Independently verified organisation details and approved local/council datasets may be a better persistent source.

**Before live policing:** procure approved tile, routing and gazetteer services (or self-host on approved infrastructure). An on-device/manual route prevents external routing disclosure, but public map tiles can still reveal the search area.

## Practical next steps for Nathan

1. Ask the force DPO/information-governance team and information-security team to sponsor a controlled pilot. Give them this data-flow description, hosting configuration and the intended user group.
2. Agree who is the controller, purposes and lawful basis, Part 3/UK GDPR scope, data classification, DPIA need/content, processor contracts and any international-transfer assessment. If high risk remains, follow the applicable consultation process.
3. Decide whether to move to force-controlled UK infrastructure or approve the proposed supplier/service configuration. Review logs, support access, subprocessors, backup retention and secure deletion. An EU database alone is insufficient assurance.
4. Individual police email addresses, three server-enforced roles, session revocation, single-use invitations and an application event log are implemented. Before live use, connect force SSO/MFA, verify account holders, approve role allocation and protect logs independently against tampering. Browser-only activity is not comprehensively logged. The 14-day pilot retention must be formally reviewed.
5. Approve a precise data standard: what counts as public-facing, how personal/sole-trader contacts are excluded, permitted asset references, photograph framing/redaction and who verifies additions. App validation is not a personal-data detector.
6. Set formal review/deletion intervals. The pilot flags verification older than six months but does not automatically remove camera records. Confirm backup retention, test recovery, and agree deletion and data-rights handling.
7. Use managed devices, an approved browser, export restrictions and approved police email. Exercise the device camera/GPS flow, accessibility, slow connections, session expiry, failed uploads and simultaneous editing with a small pilot team.
8. Arrange independent penetration testing, threat modelling, accessibility testing and an incident-response runbook before wider deployment. Check scope against the force's security standards rather than assuming a commercial hosting badge is sufficient.

## Validation and known limits

- Build, TypeScript checks and sixteen automated tests pass; dependency audit reported zero vulnerabilities after removing obsolete dependencies and applying updates.
- Live server checks passed for unauthorised record/photo access rejection, origin and CSRF enforcement, login/session attributes, sanitised import, unknown-field rejection, create/photo retrieval, concurrent-edit rejection, deletion and logout revocation. Road routing returned real street geometry.
- Additional tests verify that business lookup requires explicit consent, maps only the supported suggestion fields, and distinguishes upstream failures/partial responses from no matches. No returned business listings were saved to the camera register during this follow-up.
- Desktop clustering, manual route candidate ordering, mobile layout and quick-add submission were inspected with synthetic fixtures. These UI checks were separate from the real protected database.
- No email was sent. The email function prepares a draft; long lists download a CSV for attachment.
- No force approval, external penetration test, physical-device camera/GPS test, or successful deployed public-business lookup is claimed. The direct provider diagnostic succeeded once; that does not establish reliable integration.
- The shared credential is retired. Users can read/add/verify; supervisors can also edit and invite users; web masters manage accounts, role assignments, bulk camera operations and audit access. Police email addresses are not verified officer identities. User access removal clears its active alias and credentials, revokes sessions/invitations, and retains only an opaque account ID for audit. Keep access narrow and do not treat this as sufficient for live investigations.
- Police email addresses, hashed credentials/recovery codes, roles and actor IDs are now stored separately from camera records. This necessary access-control data may be personal data; a zero-personal-camera-content policy must not be presented as a zero-personal-data service.
- Invitation links can be copied or composed in the user’s mail application. Automatic email sending is not configured: an agreed verified sender address/domain is required. Email recipients are not stored by the app. Whoever holds an invitation can claim it once; send only through an approved channel after checking the recipient.
- Application audit covers server requests/results and explicit account/camera actions. Exports require successful event recording; manual route/POV events depend on the browser contacting the server. Static page requests, offline actions and infrastructure activity are not all captured. This log is neither immutable nor a complete police audit solution.
- The site is a responsive web application, not a separately packaged Android/iOS application. Its manifest supports a home-screen shortcut where the browser allows it. It deliberately does not cache operational data for offline use.

## Primary sources

Reviewed 10 October 2026. Recheck before operational approval.

- [Data Protection Act 2018, Part 3](https://www.legislation.gov.uk/ukpga/2018/12/part/3) — including security, DPIA and consultation duties.
- [ICO guide to law enforcement processing](https://ico.org.uk/for-organisations/law-enforcement/guide-to-le-processing/).
- [ICO pseudonymisation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/pseudonymisation/).
- [ICO: carrying out a DPIA](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/how-do-we-do-a-dpia/).
- [Google Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies) and [Maps Platform service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and [copyright/licence](https://www.openstreetmap.org/copyright).
- [Overpass HTTP API documentation](https://dev.overpass-api.de/command_line.html) and [public-instance resource policy](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).
- [FOSSGIS routing usage and privacy](https://routing.openstreetmap.de/about.html).
- [OSRM API documentation](https://project-osrm.org/docs/v26.6.1/http).
- [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).

### Account release validation

All 22 automated tests pass, including real SQLite-backed permission and invitation tests. Live checks confirmed the initial web master role, registration at the invitation’s assigned role, denial of user administration/edit access, immediate session revocation on removal, and web-master-only audit access. The temporary QA account was removed and its invitation revoked; no invitation email was sent. Existing live camera/photo/CSRF/concurrency checks also pass, with the temporary camera and photo removed. A synthetic browser fixture verified route reset, new-route selection, the POV cone and phone administration layout; that fixture was deleted after review.


## Mobile capture and email assurance update — 10 October 2026

Add camera now opens a phone-first, downward form: GPS centres the map; tapping/dragging places the camera; explicit position confirmation unlocks a draggable aim/range and width cone. Sliders are available without numeric typing. Photos and site details follow. GPS is not automatically treated as the camera position.

Sign-in, registration and recovery are restricted server-side to force subdomains ending `.police.uk`. Work email is account personal data, separate from camera content. Mailbox verification is implemented but **not enabled**: the owner selected a force-approved sender later. The live demonstration uses explicit `AUTH_MODE=password-test`; no verification email has been sent and accounts are not claimed to be mailbox-verified. See [activation steps](email-verification-activation.md) and [command-team briefing](command-team-assurance.md) in `docs/`.
