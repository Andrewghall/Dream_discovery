# Information Security Policy

| Field | Value |
|---|---|
| Status | Active |
| Version | 1.0 |
| Effective Date | 2026-04-17 |
| Owner | CISO / Engineering Lead |
| Review Date | 2027-04-17 |

---

## 1. Purpose

This policy establishes the information security framework for RAISE and the DREAM Discovery platform. DREAM Discovery is a multi-tenant SaaS application that processes personal data of workshop participants including names, email addresses, voice recordings, and qualitative business intelligence data. The purpose of this policy is to protect the confidentiality, integrity, and availability of all information assets and to meet the obligations of ISO 27001:2022, SOC 2 Type II, and GDPR.

---

## 2. Scope

This policy applies to:

- All RAISE employees, contractors, consultants, and third-party service providers with access to DREAM Discovery systems or data.
- All information assets used in the operation of DREAM Discovery, including source code, databases, cloud infrastructure, and AI pipeline components.
- All environments: production (Vercel + Supabase + Railway), pre-live (pre-live branch on Vercel), and local development.
- All sub-processors: Vercel (hosting and edge network), Supabase (PostgreSQL database and authentication), Railway (CaptureAPI voice ingestion service), and OpenAI (AI synthesis and facilitation outputs).

---

## 3. Policy Statement

### 3.1 Security Governance

3.1.1 RAISE must maintain a documented Information Security Management System (ISMS) aligned with ISO 27001:2022.

3.1.2 An appointed CISO (or Engineering Lead acting in that capacity) is responsible for owning, maintaining, and enforcing this policy.

3.1.3 Security objectives must be reviewed at least annually and whenever significant changes to the platform or threat landscape occur.

3.1.4 A formal risk assessment must be conducted at least annually and whenever a major architectural change is made to DREAM Discovery.

### 3.2 Multi-Tenant Isolation

3.2.1 DREAM Discovery enforces tenant isolation at the application layer using Prisma ORM with mandatory `organizationId` scoping on all database queries. No cross-tenant data access is permitted through any API route.

3.2.2 Supabase Row Level Security (RLS) policies provide a second layer of data isolation at the database tier. RLS must be enabled on all tables containing participant data, workshop data, transcript data, and AI-generated outputs.

3.2.3 System organisations (flagged `Organization.isSystem = true`) are subject to the same isolation controls. The `isExample` flag on workshops in system organisations does not relax access controls.

3.2.4 All multi-tenant isolation controls must be included in security regression tests and validated on every deployment to the pre-live branch.

### 3.3 Authentication and Access

3.3.1 Supabase Auth is used for all user authentication. Session tokens must be short-lived and rotated on privilege escalation.

3.3.2 Multi-factor authentication (MFA) must be enforced for all RAISE employees and for PLATFORM_ADMIN accounts on the DREAM Discovery platform.

3.3.3 All administrative API routes must validate the caller's session and organisation context before processing any request.

3.3.4 OAuth and SSO integrations are permitted only for established providers configured within Supabase Auth. Credentials must never be stored in application code or environment variable files committed to version control.

### 3.4 Data Protection

3.4.1 All data in transit must be encrypted using TLS 1.2 or higher. Vercel Edge Network enforces HTTPS on all routes. Railway CaptureAPI endpoints must also enforce TLS.

3.4.2 All data at rest in Supabase (PostgreSQL) must be encrypted using AES-256. Supabase's built-in encryption at rest is the baseline; additional column-level encryption may be required for Restricted data (see Data Classification Policy).

3.4.3 Voice recordings ingested via Railway CaptureAPI must be encrypted at rest immediately upon receipt. Recordings must not be retained beyond the period required for transcript generation and the defined retention period.

3.4.4 OpenAI API calls transmitting participant data or business intelligence must be made only over TLS. No participant personally identifiable information (PII) should be included in OpenAI prompts unless strictly necessary for the synthesis function, and only after confirming OpenAI's data processing terms are in place.

### 3.5 Secure Development

3.5.1 All source code for DREAM Discovery is stored in the private GitHub repository `Andrewghall/Dream_discovery`. Access must be limited to authorised personnel only.

3.5.2 The `main` branch is the production equivalent. No direct pushes to `main` are permitted. All changes must be made to feature branches, merged to `pre-live` for validation, and then explicitly promoted to `main` by an authorised engineer.

3.5.3 Environment variables containing secrets (database connection strings, API keys, JWT secrets) must never be committed to the repository. They must be managed via Vercel environment variable configuration and Railway service environment settings.

3.5.4 Dependency updates must be reviewed for security advisories. Dependabot or equivalent automated scanning must be enabled on the repository.

3.5.5 SQL migrations must be reviewed before execution on production. The Supabase production database is a separate instance from the pre-live database; migrations must be applied manually in the production Supabase SQL editor after each merge to `main`.

### 3.6 Network and Infrastructure Security

3.6.1 DREAM Discovery runs on Vercel serverless infrastructure. All compute is ephemeral and managed by Vercel. RAISE must review Vercel's security documentation and SOC 2 report annually.

3.6.2 Railway CaptureAPI runs in a Railway-managed container environment. Railway services must be configured to accept connections only from authorised sources.

3.6.3 Supabase database connections from the Next.js application must use connection pooling via Supabase's pooler endpoint. Direct database access must be restricted to authorised engineers using database client tools with MFA-protected Supabase dashboard access.

3.6.4 Vercel's DDoS protection and edge rate limiting must be enabled. Custom rate limiting at the API route level must be implemented for high-value endpoints (synthesis, transcript ingestion, and AI generation routes).

### 3.7 Monitoring and Logging

3.7.1 The `analytics_events` table (created by `sql/add_analytics.sql`) records platform usage events. Audit log entries must not be deletable by application-tier users or tenant administrators.

3.7.2 Vercel deployment logs and function invocation logs must be retained for a minimum of 30 days.

3.7.3 Supabase audit logs must be enabled and retained for a minimum of 90 days.

3.7.4 Anomalous access patterns (e.g., high-volume data exports, repeated authentication failures, cross-tenant query attempts) must be monitored and must trigger alerts to the Engineering Lead.

### 3.8 Physical Security

3.8.1 RAISE has no physical data centre presence. Physical security controls are delegated to Vercel (Cloudflare network), Supabase (AWS), and Railway. Annual review of each sub-processor's physical security certifications is required.

3.8.2 Employee workstations containing local copies of source code or database credentials must have full-disk encryption enabled.

### 3.9 Security Awareness

3.9.1 All RAISE employees and contractors must complete information security awareness training within 30 days of joining and annually thereafter.

3.9.2 Engineers with access to production systems must complete training specific to cloud security, GDPR obligations, and secure coding practices.

---

## 4. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| CISO / Engineering Lead | Policy ownership, annual review, risk assessment coordination, security incident escalation |
| Developers | Secure coding practices, branch protection adherence, secret management, dependency hygiene |
| All Staff | Completion of security awareness training, adherence to acceptable use policy, incident reporting |
| Third-Party Sub-Processors | Compliance with DPAs, provision of annual security certifications or SOC 2 reports |

---

## 5. Compliance and Enforcement

Violations of this policy may result in disciplinary action up to and including termination of employment or contract. Violations that constitute a breach of GDPR may be reported to the relevant supervisory authority. Technical controls (branch protection rules, Supabase RLS, application-layer org scoping) are the primary enforcement mechanism. This policy is the supporting governance layer.

---

## 6. Review Cycle

This policy must be reviewed annually, no later than 2027-04-17, or immediately upon:

- A significant change to the DREAM Discovery architecture (e.g., new sub-processor, new data type processed).
- A security incident classified as Major or Critical under the Incident Response Policy.
- A material change in applicable law or regulation (e.g., updates to UK GDPR, NIS2 scope).
