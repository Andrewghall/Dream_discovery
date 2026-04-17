# Records of Processing Activities (ROPA)

*Article 30, UK GDPR / EU GDPR*

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-04-17 |
| Controller | RAISE (operated by Ethenta Ltd) |
| Registered address | [Ethenta Ltd registered address] |
| ICO Registration Number | [To be completed] |
| Contact | privacy@raisegtm.com |
| Next Review | 2027-04-17 |

---

## Controller Details

**Organisation name:** Ethenta Ltd (trading as RAISE)
**Data controller role:** Ethenta Ltd is the data controller for all participant data collected through the DREAM Discovery platform. Client organisations are data processors acting on behalf of their own employees but Ethenta Ltd determines the purposes and means of processing on the platform.
**Data protection contact:** privacy@raisegtm.com
**Representative (if applicable):** N/A - Ethenta Ltd is UK-established.

---

## Processing Activities

---

### Activity 1 - Discovery Conversation Processing

| Field | Detail |
|---|---|
| **Activity name** | Discovery Conversation Processing |
| **Purpose** | Facilitate pre-workshop insight gathering via AI-assisted discovery conversations; generate synthesised insight reports for workshop facilitators and client organisations |
| **Legal basis** | Consent (Art. 6(1)(a) UK GDPR) - participants provide explicit informed consent prior to conversation; Legitimate interests (Art. 6(1)(f)) - processing necessary for Ethenta Ltd's core service delivery; LIA conducted and documented separately |
| **Data categories** | Identity: full name, work email address, job role, department. Conversation content: full transcript of AI-facilitated discovery conversation. Technical: IP address, browser user agent, session timestamps. Preferences: attribution preference (named or anonymous in outputs). |
| **Data subjects** | Employees and contractors of client organisations (workshop participants) |
| **Volume (estimated)** | Variable per workshop; typically 5–50 participants per workshop, multiple workshops per client organisation |
| **Recipients** | Workshop facilitators (client organisation admins - read access to synthesised outputs and transcripts); OpenAI Inc. (AI inference only, ZDR policy applied); Supabase Inc. (database storage); Vercel Inc. (application hosting); Railway Inc. (CaptureAPI voice processing pipeline) |
| **Retention period** | 12 months from workshop completion date, then automated deletion via scheduled job |
| **Deletion mechanism** | Automated scheduled deletion job; verified by execution log |
| **International transfers** | OpenAI (United States) - Standard Contractual Clauses (SCC, 2021/914) + Zero Data Retention (ZDR) policy. Railway (United States) - Standard Contractual Clauses. All other processing within EU/EEA. |
| **Security measures** | HTTPS/TLS 1.2+ for all data in transit; AES-256-GCM encryption at rest (Supabase); Row Level Security (RLS) enforced at database level scoped by organisationId; bcrypt-hashed authentication credentials; TOTP multi-factor authentication for all administrator accounts; service-role database key held server-side only |
| **Automated decision-making** | AI synthesis used for report generation only; no automated decisions with legal or similarly significant effects on individuals |
| **Special categories** | None collected |
| **DPIA reference** | DPIA-001 (see `docs/compliance/dpia.md`) |

---

### Activity 2 - Consent Records

| Field | Detail |
|---|---|
| **Activity name** | Consent Records |
| **Purpose** | Maintain evidence of lawful consent basis per GDPR Art. 7 and Art. 5(2) accountability principle; provide audit trail for ICO inquiry or subject access requests |
| **Legal basis** | Legal obligation (Art. 6(1)(c) UK GDPR) - Art. 5(2) accountability obligation requires demonstrable proof of consent |
| **Data categories** | Email address; consent timestamp (ISO 8601); version identifier of consent text shown; IP address at time of consent; browser user agent at time of consent; purpose(s) consented to; collection channel (web form / API) |
| **Data subjects** | Workshop participants who provided consent via the platform |
| **Volume (estimated)** | One record per participant per consent event; cumulative growth over platform lifetime |
| **Recipients** | Supabase Inc. (storage only); no sharing with client organisations or other third parties |
| **Retention period** | 7 years from date of consent record creation (legal requirement for evidence preservation) |
| **Deletion mechanism** | Manual deletion after 7-year legal hold period expires |
| **International transfers** | Supabase EU (AWS eu-west-1) - no international transfer |
| **Security measures** | RLS policies restrict consent record access to platform administrators only; records are append-only (no modification after creation); AES-256-GCM at rest; TLS in transit |
| **Automated decision-making** | None |
| **Special categories** | None |
| **DPIA reference** | DPIA-001 |

---

### Activity 3 - Administrator Account Management

| Field | Detail |
|---|---|
| **Activity name** | Administrator Account Management |
| **Purpose** | Platform access control; multi-tenancy management; RAISE facilitator and client organisation administrator identity and authentication |
| **Legal basis** | Legitimate interests (Art. 6(1)(f)) - processing necessary for secure platform operation, enforcing multi-tenancy isolation, and ensuring only authorised personnel access client data; contract performance as the contractual relationship with client organisations requires account provision |
| **Data categories** | Full name; work email address; role (PLATFORM_ADMIN / ORG_ADMIN); bcrypt-hashed password; login timestamps; session tokens (hashed); organisation membership; account creation and last-modified timestamps |
| **Data subjects** | Ethenta Ltd RAISE staff with platform administrator access; client organisation administrators |
| **Volume (estimated)** | Small number of RAISE administrators; 1–5 administrators per client organisation |
| **Recipients** | Supabase Inc. (database storage); Vercel Inc. (application hosting and session management); no third-party sharing |
| **Retention period** | Duration of employment or engagement with employing organisation + 12 months post-cessation |
| **Deletion mechanism** | Manual deletion on offboarding; offboarding checklist maintained by Ethenta Ltd |
| **International transfers** | Supabase EU (AWS eu-west-1) - no international transfer. Vercel - application hosting in EU primary region (SCC for any US edge functions) |
| **Security measures** | bcrypt password hashing (minimum cost factor 12); TOTP MFA mandatory for PLATFORM_ADMIN accounts; recommended for ORG_ADMIN accounts; session tokens are short-lived JWTs; account lockout after repeated failed attempts |
| **Automated decision-making** | None |
| **Special categories** | None |
| **DPIA reference** | N/A - low risk processing |

---

### Activity 4 - Audit Logging

| Field | Detail |
|---|---|
| **Activity name** | Audit Logging |
| **Purpose** | Security monitoring and incident response; compliance evidence for ISO 27001 A.8.15 (Logging); platform integrity verification; post-incident forensic investigation |
| **Legal basis** | Legal obligation (Art. 6(1)(c) UK GDPR) - security logging required under Art. 32 obligation to implement appropriate technical measures; Legitimate interests (Art. 6(1)(f)) - security monitoring necessary for protection of platform and data subjects |
| **Data categories** | IP address; browser user agent; authenticated user identity (where logged-in action); action performed (e.g. workshop created, transcript accessed); resource accessed (workshop ID, organisation ID); HTTP method and endpoint; timestamp; outcome (success / failure) |
| **Data subjects** | All platform users (workshop participants during active session; administrators) |
| **Volume (estimated)** | High volume of automated log entries; proportional to platform usage |
| **Recipients** | Supabase Inc. (storage); Ethenta Ltd engineering and security personnel (read access only, for incident investigation) |
| **Retention period** | 7 years (aligned with legal obligation and ISO 27001 retention guidance) |
| **Deletion mechanism** | Manual deletion after 7-year retention period |
| **International transfers** | Supabase EU (AWS eu-west-1) - no international transfer |
| **Security measures** | Log table is append-only; no modification or deletion permitted by application layer; access restricted to Ethenta Ltd engineering personnel via Supabase dashboard with MFA; AES-256-GCM at rest; TLS in transit |
| **Automated decision-making** | None |
| **Special categories** | None |
| **DPIA reference** | N/A - low risk; proportionate processing |

---

### Activity 5 - Analytics Events

| Field | Detail |
|---|---|
| **Activity name** | Analytics Events |
| **Purpose** | Platform usage insights; quality improvement; product development prioritisation; usage reporting to Ethenta Ltd management |
| **Legal basis** | Legitimate interests (Art. 6(1)(f)) - processing necessary for legitimate product improvement interests; LIA conducted: minimal privacy impact (no PII in event payload) does not override data subject interests |
| **Data categories** | Event type (e.g. `workshop_created`, `synthesis_triggered`, `tab_viewed`); workshop-level aggregate identifier (anonymised); timestamp; platform version. **No PII collected in event payload.** No name, email, IP, or user identifier stored in analytics events table. |
| **Data subjects** | Indirect - events are at workshop level, not user level. No individual identified. |
| **Volume (estimated)** | Moderate; one event per platform interaction |
| **Recipients** | Supabase Inc. (storage); Ethenta Ltd management and product team (aggregated dashboard) |
| **Retention period** | 24 months, then automated deletion |
| **Deletion mechanism** | Automated scheduled deletion job |
| **International transfers** | Supabase EU (AWS eu-west-1) - no international transfer |
| **Security measures** | RLS restricts analytics event read access to PLATFORM_ADMIN role; no PII fields on table by design; schema reviewed to prevent accidental PII capture |
| **Automated decision-making** | None |
| **Special categories** | None |
| **DPIA reference** | N/A - anonymised data; no individual impact |

---

## Sub-Processor Register

The following sub-processors process personal data on behalf of Ethenta Ltd as data controller. Each sub-processor has been assessed for GDPR adequacy and a Data Processing Agreement (DPA) is required.

| Sub-Processor | Role | Data Processed | Location | International Transfer Mechanism | DPA in Place |
|---|---|---|---|---|---|
| Supabase Inc. | Database hosting (Postgres), Row Level Security | All personal data (at rest) | EU - AWS eu-west-1 | EEA - no transfer mechanism required | Yes ✅ |
| Vercel Inc. | Application hosting, CDN, serverless functions | Session tokens, request metadata, application traffic | EU (primary); US edge nodes | Standard Contractual Clauses (SCC) | Yes ✅ |
| OpenAI Inc. | AI inference (GPT-4o) - conversation synthesis | Conversation transcript content (in-flight only, ZDR policy - not retained) | United States | Standard Contractual Clauses (SCC) + Zero Data Retention (ZDR) | Pending ⏳ - DPA available; ZDR terms confirmation requested |
| Railway Inc. | Voice/audio pipeline (CaptureAPI) | Voice/audio data during processing | United States | Standard Contractual Clauses (SCC) | Pending ⏳ - DPA request submitted |
| GitHub Inc. | Source code hosting and CI/CD | Source code (incidental personal data in commits minimal; no production data) | United States | Standard Contractual Clauses (SCC) | Yes ✅ |
| Upstash Inc. | Redis caching layer | Cached session and query data (short TTL) | EU | EEA - no transfer mechanism required | Yes ✅ |

**Action required:** Obtain signed DPAs from OpenAI Inc. and Railway Inc. confirming GDPR terms and applicable transfer mechanisms. Target completion: 2026-06-01.

---

## Review Cadence

| Trigger | Action |
|---|---|
| Annual review | Full ROPA review by data protection lead - due 2027-04-17 |
| New sub-processor onboarded | Add to sub-processor register; obtain DPA before processing commences |
| Sub-processor removed | Mark as inactive in register; confirm data deletion |
| New processing activity introduced | Add new entry to ROPA; conduct pre-processing risk assessment |
| Material change to existing activity | Update relevant ROPA entry and re-assess DPIA if applicable |
| Data subject request received | Verify ROPA entry covers the data requested and confirm retention/deletion status |
| Regulatory inquiry (ICO) | Provide current ROPA as primary documentary evidence |

---

## Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-04-17 | Ethenta Ltd | Initial version covering 5 processing activities and 6 sub-processors |

---

*This document is the authoritative ROPA for Ethenta Ltd (RAISE). It is maintained under version control in the DREAM Discovery repository at `docs/compliance/ropa.md`. All printed or exported copies should be verified against the repository version. This document should be made available to the ICO on request in accordance with Art. 30(4) UK GDPR.*
