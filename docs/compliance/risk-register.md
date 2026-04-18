# Risk Register

| Field | Value |
|---|---|
| **Status** | Active |
| **Version** | 1.0 |
| **Effective Date** | 2026-04-17 |
| **Organisation** | RAISE |
| **Platform** | DREAM Discovery |
| **Owner** | CISO |
| **Next Review** | 2026-10-17 |

---

## Risk Scoring Matrix

Likelihood and Impact are scored 1-5. Risk Score = Likelihood x Impact.

| Score | Likelihood | Impact |
|---|---|---|
| 1 | Rare (once in 5+ years) | Negligible (no data loss, no service disruption) |
| 2 | Unlikely (once in 2-5 years) | Minor (brief disruption, no PII compromised) |
| 3 | Possible (once per year) | Moderate (limited PII exposed, recoverable breach) |
| 4 | Likely (multiple times per year) | Significant (material PII breach, regulatory fine likely) |
| 5 | Almost certain (ongoing or imminent) | Critical (large-scale PII breach, platform unrecoverable, ICO enforcement) |

Residual Risk after current controls is expressed as a score range: Low (1-5), Medium (6-12), High (13-25).

---

## Risk Register

| ID | Risk Title | Description | Likelihood | Impact | Risk Score | Current Controls | Residual Risk | Owner | Review Date |
|---|---|---|---|---|---|---|---|---|---|
| R-01 | Data breach via SQL injection | An attacker exploits insufficient input sanitisation in a Next.js API route or Supabase query to extract cross-tenant participant PII or workshop data from the PostgreSQL database. | 2 | 5 | 10 | Prisma ORM parameterised queries prevent raw SQL injection. Zod input validation on all API routes. CodeQL security-extended queries detect SQL injection patterns on every PR. Supabase RLS provides a secondary layer. npm audit blocks known vulnerable ORM versions. | Medium (4) | Engineering Lead | 2026-10-17 |
| R-02 | Cross-tenant data access | A misconfigured Supabase Row-Level Security policy or application-layer authorisation bug allows one tenant's administrator or participants to read or modify another tenant's workshop data. | 3 | 5 | 15 | RLS policies are enforced on all tables containing tenant data. Application middleware validates tenant context on every authenticated request. RLS policies are reviewed after every schema migration. Automated tests include cross-tenant isolation assertions. | Medium (6) | Engineering Lead | 2026-10-17 |
| R-03 | Insider threat | A RAISE engineer with production database access deliberately exfiltrates tenant data, modifies audit logs, or sabotages the platform. | 2 | 5 | 10 | Production database access is restricted to named individuals. All direct database access is logged by Supabase. PLATFORM_ADMIN actions are recorded in the audit trail. Quarterly access reviews are conducted. GitHub requires PR review, preventing solo deployment of malicious code. | Medium (4) | CISO | 2026-10-17 |
| R-04 | Sub-processor failure (Supabase) | Supabase experiences a prolonged outage, data loss event, or security breach that results in loss of availability or confidentiality of DREAM Discovery data. | 2 | 5 | 10 | Supabase provides automated daily backups with PITR (7-day minimum). RAISE monitors the Supabase status page. The Backup and Recovery Policy defines RTO and RPO targets. Supabase holds SOC 2 Type II certification. | Medium (4) | Engineering Lead | 2026-10-17 |
| R-05 | Sub-processor failure (Vercel) | Vercel experiences an outage or security incident that causes the DREAM Discovery application to become unavailable or compromised. | 2 | 4 | 8 | Vercel deploys to multiple edge regions with automatic failover. Vercel holds SOC 2 Type II certification. Status monitoring is in place. Vercel environment variables are encrypted at rest. | Low (4) | Engineering Lead | 2026-10-17 |
| R-06 | Sub-processor failure (Railway) | Railway experiences an outage affecting the CaptureAPI transcription service, preventing voice capture during live workshop sessions. | 3 | 3 | 9 | Railway provides container-level restart policies. CaptureAPI is designed to fail gracefully (workshops proceed without transcription). Status monitoring is in place. Recovery runbook is documented. | Low (3) | Engineering Lead | 2026-10-17 |
| R-07 | Sub-processor failure (OpenAI) | OpenAI API becomes unavailable or raises pricing, preventing AI synthesis of workshop outputs. OpenAI experiences a data breach exposing prompts containing participant information. | 3 | 3 | 9 | OpenAI API calls include timeout and retry logic. Synthesis is an asynchronous background process; workshops are not blocked. OpenAI DPA is signed. No personally identifiable information beyond role descriptions is sent in prompts. Rate limits and error handling are implemented. | Low (3) | Engineering Lead | 2026-10-17 |
| R-08 | Cryptographic key compromise | A Supabase JWT secret, OpenAI API key, database service role key, or other cryptographic secret stored in Vercel or Railway environment variables is exposed via a misconfigured environment, leaked in a log, or exfiltrated by an insider. | 2 | 5 | 10 | Secrets are stored exclusively in Vercel and Railway secret stores (not in source code). GitHub secret scanning is enabled to detect accidental commits. Environment variable audit in CI. Secrets are rotated annually and immediately upon suspected compromise. Server-side-only environment variables are prefixed to prevent client-side exposure in Next.js. | Medium (4) | Engineering Lead | 2026-10-17 |
| R-09 | Ransomware | A ransomware attack encrypts RAISE staff devices or, in a worst case, compromises cloud infrastructure credentials to delete or encrypt Supabase data. | 2 | 4 | 8 | Supabase PITR allows recovery to any point within 7 days, bypassing ransomware encryption. Staff devices use full-disk encryption. GitHub branch protection prevents force-pushes that would overwrite the code repository. Incident response playbook includes ransomware scenario. | Low (3) | CISO | 2026-10-17 |
| R-10 | Distributed Denial of Service (DDoS) | An attacker floods the DREAM Discovery platform with traffic, exhausting Vercel serverless function invocations or Supabase connection pool capacity, causing service unavailability during a live workshop session. | 3 | 3 | 9 | Vercel provides built-in DDoS protection and auto-scaling at the edge. Upstash rate limiting is applied to all public API routes. Authentication endpoints have stricter rate limits. Supabase connection pooling (PgBouncer) protects the database tier. | Low (3) | Engineering Lead | 2026-10-17 |
| R-11 | Social engineering and phishing | A RAISE engineer or PLATFORM_ADMIN is deceived into revealing credentials or approving a fraudulent deployment via a phishing email or social engineering attack. | 3 | 4 | 12 | Security awareness training is in place (planned formal programme for 2026 Q3). GitHub requires PR review from a second engineer before merge to main. MFA enforcement for GitHub accounts is required. PLATFORM_ADMIN MFA enforcement on the platform is a planned control. Suspicious login alerts are configured in Supabase Auth. | Medium (6) | CISO | 2026-10-17 |
| R-12 | Unauthorised admin access | An attacker gains access to a PLATFORM_ADMIN account through credential stuffing, brute force, or account takeover, gaining visibility into all tenants' data. | 2 | 5 | 10 | PLATFORM_ADMIN accounts use email and password authentication with optional TOTP MFA (MFA enforcement planned). Failed login attempts are rate-limited and logged. Account creation is manual and restricted to named RAISE staff. Quarterly access reviews validate active PLATFORM_ADMIN accounts. | Medium (4) | Engineering Lead | 2026-10-17 |
| R-13 | GDPR violation | RAISE fails to honour a right-to-erasure request, processes data beyond its stated retention period, or transfers participant PII to a sub-processor without adequate legal basis, resulting in an ICO investigation and potential fine. | 2 | 4 | 8 | Data Retention and Deletion Policy defines retention periods and deletion mechanisms. GDPR erasure request process is documented with a 30-day SLA. Data Processing Agreements are in place with all sub-processors. Privacy Notice is published. Data Protection Impact Assessment conducted for AI processing. | Low (4) | CISO | 2026-10-17 |
| R-14 | AI model data memorisation | OpenAI's GPT-4o model memorises and later reproduces verbatim participant responses or confidential workshop content submitted in synthesis prompts, causing a cross-customer data leak via the model. | 1 | 4 | 4 | OpenAI DPA is signed; data submitted via the API is not used to train models by default under the API terms. Prompts are designed to include role-level descriptions, not verbatim participant names or contact details. Zero Data Retention option is evaluated for enterprise tiers. | Low (2) | Engineering Lead | 2026-10-17 |
| R-15 | Missing or bypassed MFA | Absence of enforced MFA on PLATFORM_ADMIN accounts means a single compromised password is sufficient to access all tenant data. | 3 | 5 | 15 | MFA is supported via Supabase TOTP and is strongly recommended. Enforcement for PLATFORM_ADMIN accounts is a planned control (2026 Q2 target). Current mitigation includes rate limiting, suspicious login alerts, and quarterly account review. | Medium (9) | Engineering Lead | 2026-07-17 |
| R-16 | Weak session management | Excessively long-lived session tokens allow an attacker who obtains a token (e.g. via XSS or network interception) to maintain persistent access long after the legitimate user's session has ended. | 2 | 4 | 8 | Sessions use a 24-hour sliding expiry. Tokens are invalidated on explicit logout. HTTPS is enforced on all endpoints. HttpOnly and Secure cookie flags are set on session cookies. Supabase Auth manages token lifecycle. | Low (3) | Engineering Lead | 2026-10-17 |
| R-17 | Supply chain attack via npm | A malicious actor publishes a compromised version of a direct or transitive npm dependency (e.g. via account takeover of a popular package maintainer), injecting malicious code into the platform build. | 3 | 4 | 12 | Dependabot monitors for known malicious packages and CVEs weekly. npm audit runs at high/critical level in CI. CodeQL security-extended queries detect code injection patterns. Package lock file is committed to prevent floating versions. Subresource integrity is enforced where applicable. | Medium (6) | Engineering Lead | 2026-10-17 |
| R-18 | Loss of encryption keys | The Supabase JWT secret or database encryption keys are lost or become inaccessible, rendering encrypted data unrecoverable or causing authentication to fail platform-wide. | 1 | 5 | 5 | Keys are stored in Vercel and Railway secret stores with multiple authorised viewers. Supabase manages its own encryption keys for at-rest data (AES-256). Key rotation procedures are documented. Emergency key recovery procedures are documented in the Backup and Recovery Policy. | Low (2) | Engineering Lead | 2026-10-17 |
| R-19 | Privilege escalation | A bug in the application's RBAC logic allows a participant or tenant administrator to escalate their privileges to PLATFORM_ADMIN level, or to access data beyond their assigned scope. | 2 | 5 | 10 | Role assignments are validated server-side on every request. Supabase RLS provides defence-in-depth independent of application RBAC. Privilege-sensitive routes are protected by middleware. CodeQL checks for insecure authorisation patterns. Penetration testing scope includes privilege escalation testing. | Medium (4) | Engineering Lead | 2026-10-17 |
| R-20 | Missing Zod input validation | An API route that lacks Zod schema validation accepts unexpected input types, enabling prototype pollution, type confusion, or unexpected data written to the database. | 3 | 3 | 9 | Zod input validation is a documented requirement for all API routes per CLAUDE.md. Code review checklist includes validation coverage. CodeQL queries detect unvalidated input flows. Existing API routes are audited for validation coverage as part of quarterly security reviews. | Low (3) | Engineering Lead | 2026-10-17 |
| R-21 | Audit log tampering | An insider or attacker with database access modifies or deletes audit log records to conceal malicious activity. | 2 | 4 | 8 | Audit log tables are append-only at the application layer; deletion requires CISO approval and is not exposed via any API route. Direct database access is restricted and logged by Supabase. Supabase PITR can recover deleted audit records within the 7-day window. Write-once audit log storage (separate immutable store) is a planned enhancement. | Low (4) | CISO | 2026-10-17 |
| R-22 | Retention non-compliance | The automated retention cron job (`/api/cron/retention`) fails silently, causing voice recordings or login logs to be retained beyond their stated periods, creating GDPR storage limitation violations. | 2 | 3 | 6 | Cron job execution writes a result record to `analytics_events` on each run. Operations monitors for missing cron execution records. Vercel Cron has a built-in retry mechanism. Alerting for cron failure is configured. Annual manual audit of retention compliance is conducted. | Low (2) | Operations | 2026-10-17 |
| R-23 | PLATFORM_ADMIN over-privilege | The PLATFORM_ADMIN role has unrestricted access to all tenant data, workshop content, and user PII with no additional approval gate, creating a high-value target and a disproportionate blast radius for account compromise. | 2 | 5 | 10 | PLATFORM_ADMIN accounts are limited to named RAISE staff only. All PLATFORM_ADMIN actions are logged in the audit trail. Quarterly access reviews validate the account list. Segregation of PLATFORM_ADMIN capabilities (read-only analytics vs. data deletion) is a planned enhancement. | Medium (4) | CISO | 2026-10-17 |
| R-24 | CI/CD pipeline injection | An attacker injects malicious code into the GitHub Actions CI/CD pipeline via a compromised workflow file, dependency, or pull request from a forked repository, causing malicious code to be deployed to production. | 2 | 5 | 10 | GitHub Actions workflows are pinned to specific commit SHAs for third-party actions. Pull requests from external contributors cannot directly trigger deployments to production without Engineering Lead approval. Workflow files are protected by CODEOWNERS rules. Branch protection requires passing CI checks before merge. | Medium (4) | Engineering Lead | 2026-10-17 |
| R-25 | Business continuity failure | A combination of simultaneous failures (e.g. Supabase outage plus loss of a critical engineer) prevents RAISE from restoring the DREAM Discovery platform within the contractually committed RTO, causing material breach of enterprise tenant SLAs. | 2 | 4 | 8 | Supabase PITR and daily backups minimise data loss. Vercel multi-region deployment provides application-layer resilience. Runbooks are documented for all recovery scenarios. Cross-training of at least two engineers on all critical operational procedures is in progress. Business continuity plan is documented in the Backup and Recovery Policy; a tabletop exercise is planned for 2026 Q3. | Low (4) | CISO | 2026-10-17 |

---

## Risk Heat Map Summary

| Risk Score | Count | Risk IDs |
|---|---|---|
| Critical (20-25) | 0 | -- |
| High (13-19) | 2 | R-02, R-15 |
| Medium (6-12) | 18 | R-01, R-03, R-04, R-05, R-06, R-07, R-08, R-09, R-10, R-11, R-12, R-13, R-16, R-17, R-19, R-20, R-22, R-23, R-24, R-25 |
| Low (1-5) | 5 | R-14, R-18 |

---

## Version History

| Version | Date | Author | Summary of Changes |
|---|---|---|---|
| 1.0 | 2026-04-17 | CISO | Initial release with 25 identified risks |
