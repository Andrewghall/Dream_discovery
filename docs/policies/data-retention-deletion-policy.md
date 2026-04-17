# Data Retention and Deletion Policy

| Field | Value |
|---|---|
| **Status** | Active |
| **Version** | 1.0 |
| **Effective Date** | 2026-04-17 |
| **Owner** | Engineering Lead |
| **Approved By** | CISO |
| **Next Review** | 2027-04-17 |

---

## 1. Purpose

This policy defines the retention periods for all categories of personal and operational data processed by the DREAM Discovery platform, the mechanisms by which data is deleted at end-of-life, and the legal bases under which RAISE retains personal data. The policy supports compliance with UK GDPR Article 5(1)(e) (storage limitation), Article 17 (right to erasure), and ISO 27001:2022 control A.5.33 (protection of records).

---

## 2. Scope

This policy applies to all personal data and operational data held in:

- The Supabase PostgreSQL database (primary data store for the DREAM Discovery platform).
- Supabase Storage (file uploads, voice recordings, and document artefacts).
- Upstash Redis (session state and rate-limiting counters).
- Vercel log storage (application and edge function logs).
- Railway log storage (CaptureAPI service logs).
- Any backup snapshots taken by Supabase or maintained by RAISE.

The policy covers all tenant organisations, their participants, RAISE staff, and PLATFORM_ADMIN users.

---

## 3. Retention Schedule

The following table specifies the maximum retention period for each data category. "Contract period" means the duration of the active subscription agreement between RAISE and the tenant organisation, plus the post-termination tail period specified in the applicable agreement.

| Data Category | Storage Location | Retention Period | Legal Basis | Notes |
|---|---|---|---|---|
| Login attempt logs (failed and successful auth events) | Supabase `analytics_events` / auth logs | 90 days | Legitimate interests (fraud prevention and security monitoring) | Auto-deleted by retention cron job |
| Active session tokens | Supabase Auth / Upstash Redis | Duration of session; invalidated on logout or 24-hour sliding expiry | Contract performance | Immediately invalidated on explicit logout |
| Expired and revoked session tokens | Supabase Auth tables | 0 days -- deleted immediately on expiry or revocation | N/A | No residual storage of expired tokens |
| Password reset tokens | Supabase Auth tables | 7 days from issuance, or on first use, whichever is sooner | Contract performance | One-time use; invalidated immediately on use |
| Analytics events (platform usage telemetry) | Supabase `analytics_events` table | 2 years from event timestamp | Legitimate interests (product analytics and performance monitoring) | Pseudonymised where possible; no granular PII |
| Audit logs (admin actions, data access, permission changes) | Supabase audit log tables | 2 years from event timestamp | Legal obligation (ISO 27001; contractual obligations to enterprise tenants) | Read-only; deletion requires CISO approval |
| Withdrawn consent records | Supabase consent tables | 90 days from withdrawal date, then anonymised | Legal obligation (demonstrating compliance with consent withdrawal) | Retained in anonymised form thereafter as proof of withdrawal |
| Participant PII (names, email addresses, role, organisation) | Supabase `participants` and related tables | 36 months from end of contract period, or until deletion requested, whichever is sooner | Contract performance; legitimate interests | Subject to GDPR right-to-erasure requests within 30 days |
| Workshop data (responses, synthesis outputs, AI-generated content) | Supabase `workshops`, `workshop_scratchpads`, and related tables | 36 months from end of contract period | Contract performance | Tenant may request earlier deletion |
| AI synthesis outputs (GPT-4o generated scratchpad content stored as JSONB) | Supabase `workshop_scratchpads.v2_output`, `workshops.evidence_synthesis`, `workshops.behavioural_interventions` | 36 months from end of contract period | Contract performance | Considered tenant-owned output data |
| Voice recordings (captured via CaptureAPI on Railway) | Supabase Storage or Railway temporary storage | 7 days maximum from capture date, then permanently deleted | Legitimate interests (session facilitation only); explicit consent at capture | Auto-deleted by retention cron job within the 7-day window regardless of synthesis status |
| Transcript chunks and timecodes | Supabase `transcript_chunks` table | 36 months from end of contract period | Contract performance | Derived from voice recordings; retention is independent of source recording deletion |
| Document evidence uploads | Supabase Storage (`evidence_documents` bucket) | 36 months from end of contract period | Contract performance | Physical files; associated metadata in `evidence_documents` table follows the same schedule |
| Password hashes | Supabase Auth (managed) | Duration of active account; deleted within 30 days of account termination | Contract performance | Managed by Supabase Auth; RAISE does not have direct access to hash values |
| GDPR Subject Access Request records | RAISE internal records | 3 years from completion of request | Legal obligation | Retained as evidence of compliance |
| Employee and contractor personal data | RAISE HR systems (out of scope of this platform) | Per RAISE Employment Data Retention Policy | Contract performance; legal obligation | Not stored in the DREAM Discovery platform |

---

## 4. Deletion Mechanisms

### 4.1 Automated Retention Cron Job

A scheduled Next.js API route at `/api/cron/retention` runs daily at 02:00 UTC, invoked by Vercel Cron. This job:

1. Deletes login attempt log records older than 90 days from `analytics_events` where `event_type IN ('login_success', 'login_failure')`.
2. Deletes voice recording files from Supabase Storage where the file `created_at` timestamp is older than 7 days. Associated `transcript_chunks` records are NOT deleted at this stage; only the raw audio file is removed.
3. Deletes expired password reset tokens older than 7 days from Supabase Auth tables (where not already invalidated by Supabase Auth's built-in expiry).
4. Anonymises withdrawn consent records older than 90 days by nullifying name and email fields and setting a `anonymised_at` timestamp.

The cron job is authenticated via a bearer token stored in the `CRON_SECRET` environment variable, which is rotated annually. Execution results are written to the `analytics_events` table with `event_type = 'cron_retention_run'` for audit purposes.

### 4.2 Admin Deletion UI

The DREAM Discovery admin interface provides tenant administrators with the ability to:

- Delete individual participant records (triggers soft-delete immediately, hard-delete scheduled within 30 days to allow recovery window).
- Delete an entire workshop and all associated data (requires confirmation; permanently removes all related records from `workshops`, `workshop_scratchpads`, `transcript_chunks`, `evidence_documents`, and Supabase Storage within 24 hours).
- Export then delete: tenant admins may request a full data export (JSON + HTML) before deletion.

PLATFORM_ADMIN users may perform the above actions on behalf of any tenant organisation and may additionally trigger immediate hard-delete of soft-deleted records.

### 4.3 GDPR Subject Access Request and Erasure Process

When RAISE receives a right-to-erasure (Article 17) request:

1. The request is logged in the GDPR SAR tracker maintained by the CISO within 1 business day.
2. The Engineering Lead identifies all data records associated with the data subject across all tables and storage buckets within 5 business days.
3. Deletion is executed within 30 days of the original request, unless a legal exemption applies (e.g. ongoing legal proceedings, tax obligations).
4. If deletion is refused or limited, the data subject is notified in writing with the specific legal basis for refusal.
5. Completion of the erasure is recorded in the GDPR SAR tracker with a timestamp and the name of the engineer who executed the deletion.

Anonymisation (rather than deletion) is used only where complete deletion would destroy data that RAISE is legally obligated to retain; in such cases the data subject is informed of this constraint.

---

## 5. GDPR Legal Basis Summary

| Processing Purpose | Legal Basis (UK GDPR Article 6) | Retention Rationale |
|---|---|---|
| Delivering the DREAM Discovery platform to tenants | Article 6(1)(b) -- contract performance | Data needed for active service delivery |
| Security monitoring and fraud prevention | Article 6(1)(f) -- legitimate interests | Short retention (90 days) proportionate to security need |
| Product analytics and platform improvement | Article 6(1)(f) -- legitimate interests | Pseudonymised; 2-year window proportionate to product cycle |
| Compliance with ISO 27001 audit obligations | Article 6(1)(c) -- legal obligation | Audit logs retained 2 years as required by surveillance audits |
| Demonstrating GDPR compliance (consent records) | Article 6(1)(c) -- legal obligation | Proof of consent withdrawal retained 90 days before anonymisation |

Where special category data (such as health information captured during PAMWellness workshops) is processed, RAISE relies on Article 9(2)(a) explicit consent, and the above retention periods apply with equal or greater strictness.

---

## 6. Roles and Responsibilities

| Role | Responsibilities |
|---|---|
| **Engineering Lead** | Maintains and tests the `/api/cron/retention` job, implements deletion tooling in the admin UI, responds to technical aspects of GDPR erasure requests, rotates the `CRON_SECRET` annually. |
| **CISO** | Owns the GDPR SAR tracker, approves exceptions to retention periods, reviews this policy annually, ensures sub-processor Data Processing Agreements reflect these retention commitments. |
| **Operations** | Monitors cron job execution logs for failures, escalates retention cron failures to the Engineering Lead within 24 hours. |
| **All Tenant Administrators** | Must not retain data exports beyond their own organisational data retention policies; responsible for informing RAISE of contract termination so end-of-contract deletion can be scheduled. |

---

## 7. Review Cycle

This policy is reviewed annually or following:

- Any change to the platform's data model that introduces a new category of personal data.
- A GDPR enforcement action or relevant ICO guidance update.
- A change in the contractual data retention obligations agreed with enterprise tenants.
- An ISO 27001 audit finding relating to records management or data retention.

| Version | Date | Author | Summary of Changes |
|---|---|---|---|
| 1.0 | 2026-04-17 | Engineering Lead | Initial release |
