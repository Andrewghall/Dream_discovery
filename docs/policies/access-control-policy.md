# Access Control Policy

| Field | Value |
|---|---|
| Status | Active |
| Version | 1.0 |
| Effective Date | 2026-04-17 |
| Owner | CISO / Engineering Lead |
| Review Date | 2027-04-17 |

---

## 1. Purpose

This policy defines the principles and controls governing who may access DREAM Discovery systems, data, and infrastructure, and under what conditions. DREAM Discovery is a multi-tenant platform where incorrect access controls directly risk cross-tenant data exposure, participant PII leakage, and violation of GDPR obligations. Access must be granted on a least-privilege basis and revoked promptly when no longer required.

---

## 2. Scope

This policy applies to:

- All RAISE employees, contractors, and third parties who access DREAM Discovery application interfaces, GitHub source code, Vercel deployment console, Supabase dashboard, Railway dashboard, or OpenAI organisation settings.
- All application-tier user roles within DREAM Discovery: PLATFORM_ADMIN, tenant administrators, facilitators, and workshop participants.
- All service-to-service credentials including Supabase service role keys, Railway API tokens, OpenAI API keys, and Vercel environment secrets.

---

## 3. Policy Statement

### 3.1 Access Control Principles

3.1.1 All access must be granted on the principle of least privilege. Users and services receive only the minimum permissions required to perform their function.

3.1.2 Access must be formally requested and approved by the Engineering Lead before being provisioned. There must be no ad hoc or informal access grants.

3.1.3 All access grants must be documented and subject to periodic review.

3.1.4 Shared accounts and shared credentials are prohibited. Each individual must have a uniquely identifiable account.

### 3.2 Application-Tier Role Model

3.2.1 DREAM Discovery enforces the following role hierarchy within the application:

| Role | Access Scope |
|---|---|
| PLATFORM_ADMIN | Full access to all organisations, workshops, and administrative dashboards. Sessions use the `userId`-nullable session model (see `sql/make_session_user_id_nullable.sql`). |
| Tenant Administrator | Full access within their own organisation. Cannot access any other organisation's data. |
| Facilitator | Access to assigned workshops within their organisation. Cannot access other workshops or admin functions. |
| Participant | Read access to their own workshop session data only. |

3.2.2 Role assignments must be stored in the database and enforced at the API route level. Frontend-only role checks are insufficient and must not be relied upon as a security control.

3.2.3 The application must validate `organizationId` scoping on every database query that touches tenant data. Prisma ORM query helpers with mandatory organisation scope are the primary enforcement mechanism.

3.2.4 Supabase RLS policies provide a second enforcement layer. RLS must be enabled and tested on all tables containing participant data, workshop records, transcript chunks, scratchpad outputs, evidence documents, and analytics events.

### 3.3 Authentication Requirements

3.3.1 All user authentication is handled by Supabase Auth. Passwords must meet a minimum complexity requirement of 12 characters including mixed case, digits, and special characters.

3.3.2 Multi-factor authentication must be enforced for:
- All RAISE employees and contractors accessing any system.
- All PLATFORM_ADMIN accounts.
- The Supabase dashboard (production and pre-live projects).
- The Vercel dashboard.
- The Railway dashboard.
- The GitHub organisation.

3.3.3 Session tokens must be invalidated on logout. Supabase JWT tokens must have a maximum lifetime of 1 hour for standard users and 15 minutes for PLATFORM_ADMIN sessions.

3.3.4 Failed login attempts must be rate-limited. After 5 consecutive failures, the account must be temporarily locked for a minimum of 15 minutes.

### 3.4 Infrastructure and Service Account Access

3.4.1 Supabase service role keys grant unrestricted database access bypassing RLS. These keys must never be exposed to the client-side application bundle. They must be stored only in server-side Vercel environment variables and Railway environment settings.

3.4.2 The Supabase `anon` (public) key may be used in the client-side application only for operations that are explicitly permitted by RLS policies. The scope of operations permitted via the `anon` key must be reviewed any time RLS policies are modified.

3.4.3 OpenAI API keys must be stored as server-side Vercel environment variables only. They must never appear in client-side code, GitHub commits, or log output.

3.4.4 Railway CaptureAPI authentication tokens must be rotated at least every 90 days or immediately upon suspected compromise.

3.4.5 GitHub repository access must be restricted to named RAISE engineers. Deploy keys or machine user tokens used for CI/CD must have the minimum required permissions (read access for builds; no write access unless required for automated tagging).

### 3.5 Access Provisioning and Deprovisioning

3.5.1 New access must be provisioned within 2 business days of a formal request being approved by the Engineering Lead.

3.5.2 Access for employees or contractors who leave RAISE must be revoked within 24 hours of their departure. This includes:
- Removal from the GitHub organisation.
- Revocation of Vercel team membership.
- Revocation of Supabase project access.
- Revocation of Railway team access.
- Revocation of OpenAI organisation access.
- Rotation of any shared secrets the individual may have had access to.

3.5.3 Role changes (e.g., promotion, reassignment) must trigger an access review. Former permissions that are no longer appropriate must be revoked within 2 business days.

### 3.6 Access Reviews

3.6.1 A formal access review must be conducted every 6 months for all personnel with access to production systems.

3.6.2 The review must confirm that each access grant remains necessary and appropriate. Any access that cannot be positively justified must be revoked.

3.6.3 PLATFORM_ADMIN accounts must be reviewed quarterly given their unrestricted scope.

3.6.4 Dormant accounts (no login activity for 60 days) must be identified and either reactivated with fresh MFA setup or permanently deactivated.

### 3.7 Privileged Access Management

3.7.1 Direct production database access (via Supabase SQL editor or psql) is a privileged operation. It must be:
- Conducted only by a named RAISE engineer.
- Limited to the scope of a specific, documented task.
- Reviewed and approved by a second engineer for any data modification.
- Logged in the incident or change record.

3.7.2 Execution of SQL migrations on the production Supabase database must follow the DB migration checklist defined in CLAUDE.md. Ad hoc SQL execution on production without a corresponding migration record is prohibited.

---

## 4. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Engineering Lead | Approving all access requests, conducting access reviews, revoking access on departure |
| CISO | Owning this policy, auditing access logs, ensuring MFA compliance |
| Developers | Implementing role checks at API route level, maintaining RLS policies, never embedding credentials in code |
| All Staff | Requesting access through the formal process, reporting suspected unauthorised access |

---

## 5. Compliance and Enforcement

Unauthorised access to DREAM Discovery systems or data, or circumvention of any control defined in this policy, constitutes a serious security violation and may result in disciplinary action and legal consequences. All access activity is subject to logging and audit. Violation of least-privilege principles in code (e.g., missing `organizationId` scoping on a query) must be treated as a security defect and remediated as a high-priority fix.

---

## 6. Review Cycle

This policy must be reviewed annually, no later than 2027-04-17, or immediately following a security incident involving unauthorised access or privilege escalation.
