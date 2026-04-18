# Backup and Recovery Policy

| Field | Value |
|---|---|
| Status | Active |
| Version | 1.0 |
| Effective Date | 2026-04-17 |
| Owner | CISO / Engineering Lead |
| Review Date | 2027-04-17 |

---

## 1. Purpose

This policy defines the backup, recovery, and business continuity requirements for the DREAM Discovery platform. DREAM Discovery processes and stores workshop participant data, voice recordings, AI-generated outputs, and commercially sensitive business intelligence on behalf of tenant organisations. Loss of this data would cause material harm to those organisations and potentially breach GDPR obligations regarding data integrity and availability. This policy ensures that adequate backup capabilities exist and that recovery procedures are tested and documented.

---

## 2. Scope

This policy covers all data stores and services that form part of the DREAM Discovery production environment: the Supabase production PostgreSQL database, Railway CaptureAPI transient storage, Vercel application deployments, and the GitHub source code repository. It also addresses recovery objectives for each component.

---

## 3. Recovery Objectives

| Component | Recovery Point Objective (RPO) | Recovery Time Objective (RTO) |
|---|---|---|
| Supabase Production Database | 24 hours (point-in-time recovery) | 4 hours |
| Vercel Application (code + deployment) | Zero data loss (code in Git) | 30 minutes (rollback to previous deployment) |
| Railway CaptureAPI service | N/A (stateless; recordings transient) | 2 hours (redeploy from Railway config) |
| GitHub Repository | Zero data loss (distributed) | 1 hour (re-clone from GitHub) |

---

## 4. Policy Statement

### 4.1 Database Backup -- Supabase Production

4.1.1 Supabase provides automated daily backups and point-in-time recovery (PITR) for PostgreSQL databases on paid plans. RAISE must maintain a Supabase plan that includes PITR with a minimum 7-day recovery window.

4.1.2 Supabase daily backups must be verified to be running by the Engineering Lead at least monthly. The Engineering Lead must check the Supabase dashboard backup status and record the verification date.

4.1.3 Point-in-time recovery allows restoration to any point within the backup window. This is the primary recovery mechanism for database corruption or accidental data loss.

4.1.4 In addition to Supabase PITR, the Engineering Lead must perform a manual logical backup (pg_dump) of the production Supabase database at least monthly. These backups must be encrypted at rest (AES-256) and stored in a separate location from the primary Supabase infrastructure (e.g., encrypted archive on a separate cloud storage provider).

4.1.5 Manual backup files must be protected with a passphrase stored in a secure credential store separate from the backup files themselves.

4.1.6 Backup integrity must be verified by performing a test restore to a non-production database environment at least quarterly. The test restore must confirm that the restored database is functional and complete.

### 4.2 Database Backup -- Pre-Live (Supabase)

4.2.1 The pre-live Supabase database is a separate instance from production (configured via `.env.local`). It contains seeded and testing data rather than live participant data.

4.2.2 Pre-live database backups are desirable but not required to meet the same RPO/RTO as production. Loss of the pre-live database must be recoverable by re-running the seed scripts (`scripts/seed-retail-snapshot.ts`).

4.2.3 The pre-live database schema must always reflect the same schema as production (same applied migrations). The Migration Checklist in CLAUDE.md must be kept current.

### 4.3 Application Code and Deployment Backup

4.3.1 All DREAM Discovery application code is stored in the GitHub repository (`Andrewghall/Dream_discovery`). Git provides inherent version history and distributed backup of all committed code.

4.3.2 The GitHub repository must be configured with branch protection rules that prevent force-pushes and deletion of the `main` and `pre-live` branches.

4.3.3 Vercel retains all previous deployment artefacts and allows instant rollback to any previous successful deployment via the Vercel dashboard. This is the primary application recovery mechanism for failed deployments.

4.3.4 A GitHub repository export (zip archive) must be created at least annually and stored securely off-platform, to guard against account suspension or platform unavailability.

### 4.4 Railway CaptureAPI Recovery

4.4.1 Voice recordings in Railway CaptureAPI are transient. They are ingested, processed into transcripts, and then deleted per the retention schedule. There is no expectation of backup for raw voice recordings after the transcript has been generated.

4.4.2 If Railway CaptureAPI becomes unavailable, voice ingestion for new workshops will be suspended. Existing transcript data stored in Supabase is not affected.

4.4.3 Railway service configuration must be documented (service name, environment variables, resource allocation) sufficiently to allow redeployment within the 2-hour RTO in the event of service loss. Configuration documentation must be maintained in a secure internal wiki or document store, not in the public repository.

4.4.4 Railway API tokens and service credentials required for redeployment must be stored in the RAISE secure credential store and must be accessible to at least two named engineers.

### 4.5 Business Continuity

4.5.1 In the event of a complete Supabase production database loss (beyond the recovery window), RAISE must have documented procedures for:
- Notifying affected tenant organisations of the data loss.
- Assessing whether the loss constitutes a GDPR personal data breach (loss of availability of personal data may qualify).
- Engaging Supabase support for recovery assistance.

4.5.2 In the event of extended Vercel unavailability, RAISE must assess whether static or reduced-functionality serving from an alternative deployment is feasible for critical tenant operations.

4.5.3 RAISE must maintain up-to-date emergency contact information for Supabase, Vercel, and Railway support channels, accessible to the Engineering Lead and CISO at all times.

### 4.6 Recovery Testing

4.6.1 A documented recovery test must be conducted at least annually. The test must simulate a scenario requiring database point-in-time recovery and application deployment rollback.

4.6.2 Recovery test results must be documented, including: date, scenario tested, time to complete recovery, any issues encountered, and remediation actions.

4.6.3 Recovery procedures must be updated following any test that reveals gaps or changes in the sub-processor capabilities.

### 4.7 Sensitive Data in Backups

4.7.1 All database backups contain personal data (participant PII, transcript data) and are therefore subject to the same data protection obligations as the live database. Backups must be:
- Encrypted at rest (AES-256).
- Stored with access restricted to named individuals.
- Retained only for the duration required (backup retention aligned with data retention policy, maximum 36 months).
- Securely deleted when no longer required.

4.7.2 Backup decryption keys must be stored separately from the encrypted backup files and must be protected with the same controls as production credentials.

---

## 5. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Engineering Lead | Monthly backup verification, quarterly restore testing, annual recovery test, maintaining Railway configuration documentation |
| CISO | Approving backup policy, reviewing recovery test results, assessing data loss events for GDPR implications |
| All Engineers | Ensuring production secrets required for recovery are in the secure credential store; not storing sensitive data outside approved backup locations |

---

## 6. Compliance and Enforcement

Failure to maintain functioning backups within the defined RPO/RTO constitutes a risk to the availability of personal data and to RAISE's GDPR obligations under Article 32 (security of processing). The Engineering Lead must report backup status as part of the quarterly security review.

---

## 7. Review Cycle

This policy must be reviewed annually, no later than 2027-04-17, or following any data loss event or recovery test failure.
