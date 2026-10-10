# CCTV Enquiries: command-team assurance briefing

**10 October 2026 · Demonstration system · Decision sought: sponsor a controlled assurance exercise, not operational deployment.**

The application helps officers locate public-facing business and council CCTV, estimate camera views, and produce a route-ordered enquiry list. It does not hold footage or identify people. A map of cameras, coverage and investigative routes can nevertheless be sensitive. A police-looking interface and encryption do not establish force approval.

## Current position

| Area | Implemented or checked | Remaining decision or evidence |
|---|---|---|
| Access | Password authentication; server-enforced User, Supervisor and Web master permissions; invite-only registration; force-domain email restriction | Mailbox verification is built and tested with a simulated sender but **not enabled**. Nathan selected a force-approved sender later. The demonstration explicitly uses password-test mode; unverified accounts are labelled. No MFA or force single sign-on yet. |
| Encryption | HTTPS, secure HTTP-only sessions, HSTS; D1 provides automatic AES-256 encryption at rest and TLS between Worker and database [1] | Keys are provider-managed. No application-level encryption with force-controlled keys. Encryption does not prevent misuse by an authorised account or compromise of the running application. |
| Data location | Live database metadata checked: EU jurisdiction, running region EEUR; read replication disabled | EU is not UK-only. This setting does not establish UK-only edge processing, TLS termination, metadata, support access, backups or every subprocessor. D1 currently lists EU, US and FedRAMP jurisdictions, not a UK jurisdiction [2]. |
| External services | Map tiles need a notice; routing and nearby-business lookups require an explicit action | OpenStreetMap tile requests reveal viewed areas and browser IP; FOSSGIS receives route anchors and logs requests; Overpass receives lookup coordinates. Do not send operational investigative locations to these public test services. |
| Camera content | Restricted camera schema; no household cameras, ANPR or footage; public organisation contacts; photo review and JPEG metadata removal | Free text and photographs cannot be guaranteed free of personal information by validation alone. Publicly listed sole-trader contacts can still be personal data. References may also be identifying when linked to police systems. |
| Audit and resilience | Server request/action logs, access controls, session revocation, password hashing, CSRF checks; 14-day event retention | Audit is not immutable or a comprehensive evidential log. No completed independent penetration test, disaster-recovery exercise, force retention approval, incident-response agreement or service-level agreement. |

## What “more encryption” would achieve

**Keep transport and storage encryption.** These address interception and loss of storage media. D1 manages its own encryption keys; this is not end-to-end encryption from the force's perspective [1].

**Consider application-level encryption for sensitive fields and reference photos**, with envelope encryption and keys in a force-controlled key-management service. Separate key administrators from database administrators; log decryptions; rotate keys; prove backup and key recovery together. This would reduce exposure from a database-only compromise. It would not hide information from an authorised application that has decryption rights, a compromised user device, or an external map provider receiving a request. Search, camera filtering and mapping need careful design around what is decrypted. Do not add an improvised browser key or store the encryption key beside the database and describe that as a complete solution.

**Prefer reducing disclosure to adding encryption afterwards.** Keep names, case narratives, suspect details and footage on approved police systems. Avoid storing investigation routes. Treat account emails, roles, verification records and audit identifiers as personal/security data with their own retention and access rules. An export is another copy and needs downstream controls.

## Hosting recommendation for a force pilot

| Option | Assessment |
|---|---|
| Existing personal Cloudflare account and public test mapping | Suitable for controlled demonstration with agreed test data only. Cheapest way to demonstrate workflow. Not the recommended home for live police material. |
| Force-owned tenancy in an already approved UK cloud environment | **Preferred candidate for assessment.** Use the force's existing identity provider, managed devices, private database networking, UK regional services and force-owned key management. Check the actual service, backup, support and contractual boundaries; a UK region name alone is insufficient. |
| Cloudflare under a force contract with additional locality controls | Possible assessment route, not an approval. Regional Services, metadata boundaries and database jurisdiction are separate controls [2,3]. Obtain product-specific written evidence and a costs/limitations assessment. Do not assume D1's EU jurisdiction provides UK-only hosting. |
| Force-hosted/private infrastructure | More direct control over locality and routing; requires the force to fund patching, availability, backups, monitoring and support. It is not inherently secure simply because it is on premises. |

Use force-approved or locally hosted map tiles, geocoding and walking/driving routing. An internal OSRM/Valhalla-equivalent service can keep route anchors inside the approved boundary, but requires maintained mapping data, licensing compliance, resilience and tested routing profiles. Do not connect live camera feeds until they have a separate authorisation and assurance review.

## Access and verification: staged implementation

1. **Now:** restricted `.police.uk` email domains, existing password, invite-only accounts and server permissions. The owner's login changes to the specified work email; its password hash and Web master role remain unchanged.
2. **Prepared, awaiting approved sender:** password is checked before an eight-character random email code is issued. Only a code hash and challenge hash are stored; expiry is ten minutes, five code attempts, with resend/account/IP limits. Verification is single-use. No session is issued in enforced mode until mailbox proof succeeds. Email content contains no camera or investigation data. Delivery failure denies access in enforced mode. This verifies access to a mailbox at that time; it does not establish ongoing employment or replace MFA.
3. **Before operational use:** force single sign-on, MFA, device compliance, joiner/mover/leaver controls and periodic entitlement review. Use force approval for elevated roles. Replace reusable recovery arrangements with the approved identity process.

The live demonstration remains explicitly in `AUTH_MODE=password-test` until the force-approved sender is configured. It must not be presented as verified-email authentication. Activation steps are in `email-verification-activation.md`.

## Assurance work and decision owners

| Gate | Owner to nominate | Evidence required before live use |
|---|---|---|
| Purpose, information classification and legal basis | Information asset owner, DPO and legal services | Data-flow inventory; decide applicable UK GDPR and/or DPA 2018 Part 3 regimes for each purpose; DPIA screening and, where required, completed DPIA. High-risk processing requires a DPIA before it begins [5]. |
| Suppliers and locality | Procurement, architecture and information security | Processor terms, subprocessor list, transfer assessment where relevant, approved regions, remote support access, retention/deletion and exit arrangements. |
| Identity and devices | Force identity/security teams | SSO/MFA policy, approved sender, verified joiner/leaver process, managed-device conditions and administrator separation. |
| Security assessment | Information security / independent tester | Threat model, independent penetration test, dependency and secret scanning, remediation evidence, abuse controls and reviewed release process. |
| Audit and recovery | Service owner and security operations | Protected central audit, appropriate event coverage and retention, alerting, incident playbook, tested restore, recovery time/point objectives, named support cover. |
| Pilot acceptance | Command sponsor / information asset owner | Agreed test scope, users, data, success criteria, accessibility checks, rollback plan and signed residual-risk decision. |

Assess the provider **and the configured service** against the NCSC's 14 Cloud Security Principles; provider certifications are evidence inputs, not a certification of this application [4]. This document records engineering findings and proposed controls, not a legal opinion, DPIA or accreditation decision. ICO notes that relevant guidance is under review following the Data (Use and Access) Act 2025; obtain a current force legal review [5].

## Evidence and sources

Engineering evidence: 22 automated checks covering account permissions, registration, recovery, domain lookalikes, verification failure/expiry/replay, data validation and routing. Browser checks use a separate synthetic fixture; they are not an independent security assessment. GPS requires permission on a real phone and should be included in pilot acceptance.

1. [Cloudflare D1 data security](https://developers.cloudflare.com/d1/reference/data-security/) — provider encryption and key-management description.
2. [Cloudflare D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/) — jurisdictions and non-guaranteed location hints.
3. [Cloudflare Regional Services](https://developers.cloudflare.com/data-localization/regional-services/) — separate processing-locality controls.
4. [NCSC Cloud Security Principles](https://www.ncsc.gov.uk/collection/cloud/the-cloud-security-principles) — supplier and service assessment framework.
5. [ICO: law-enforcement DPIAs](https://ico.org.uk/for-organisations/law-enforcement/guide-to-le-processing/accountability-and-governance/data-protection-impact-assessments/) and [Data Protection Act 2018, section 64](https://www.legislation.gov.uk/ukpga/2018/12/section/64) — force legal/DPO review required.
6. [FOSSGIS routing privacy and usage](https://routing.openstreetmap.de/about.html) — route requests logged by the public routing provider.

Sources checked 10 October 2026. The legislation site could not be fully retrieved in this session; the DPIA summary above is supported by ICO guidance. Recheck the current statutory text during legal assurance.
