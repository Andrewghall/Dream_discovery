# Change Management Policy

| Field | Value |
|---|---|
| Status | Active |
| Version | 1.0 |
| Effective Date | 2026-04-17 |
| Owner | CISO / Engineering Lead |
| Review Date | 2027-04-17 |

---

## 1. Purpose

This policy defines the process for planning, reviewing, approving, implementing, and reviewing changes to the DREAM Discovery platform. Uncontrolled changes to application code, database schema, infrastructure configuration, and sub-processor integrations are a primary source of security vulnerabilities, data loss, and service outages. A disciplined change management process protects the availability and integrity of DREAM Discovery and the personal data it processes.

---

## 2. Scope

This policy covers all changes to:

- DREAM Discovery application code in the GitHub repository (`Andrewghall/Dream_discovery`).
- Database schema migrations applied to the Supabase pre-live or production databases.
- Infrastructure configuration changes in Vercel (environment variables, domain settings, deployment configuration).
- Railway CaptureAPI service configuration changes.
- OpenAI integration configuration (model selection, API key rotation, prompt templates).
- Supabase project configuration (RLS policies, auth settings, storage configuration).
- Any new third-party integration or sub-processor addition.

---

## 3. Policy Statement

### 3.1 Change Categories

#### 3.1.1 Standard Changes

Pre-approved, low-risk changes with a well-understood implementation path and negligible risk of adverse impact.

Examples: routine dependency updates with no security advisories, documentation updates, UI copy changes, addition of new workshop facilitation questions that do not alter data schema.

Process: Implement on feature branch, push to `pre-live` for validation, promote to `main`. No additional approval required beyond the standard code review.

#### 3.1.2 Normal Changes

Changes that require assessment, planning, and approval before implementation. These are the majority of feature development and bug fix changes.

Examples: new database columns or tables, new API routes, changes to authentication or session management, new AI synthesis prompts, new scratchpad output tabs, changes to Supabase RLS policies, Prisma schema modifications.

Process: See Section 3.3.

#### 3.1.3 Emergency Changes

Changes required to immediately address a Critical or Major security incident or service outage, where the standard review timeline cannot be followed.

Examples: patching an actively exploited vulnerability, rotating a compromised API key, deploying a hotfix for a cross-tenant data leak.

Process: See Section 3.5.

#### 3.1.4 Major Changes

Significant architectural changes that introduce new data flows, new sub-processors, new personal data types, or fundamental changes to authentication or tenancy models.

Examples: adding a new AI model provider, introducing new biometric or special category data processing, re-architecting the multi-tenancy model, migrating to a new database provider.

Process: As per Normal Changes plus a formal security impact assessment (Data Protection Impact Assessment (DPIA) where required by GDPR) and written approval from the CISO before implementation.

### 3.2 Branch Strategy and Environment Promotion

3.2.1 All changes must begin on a feature branch created from the current `pre-live` branch.

3.2.2 The `pre-live` branch on GitHub is directly connected to the Vercel pre-live deployment. Pushing to `pre-live` automatically triggers a Vercel deployment to the pre-live environment.

3.2.3 The `pre-live` environment is the validation environment. All changes must be proven working on `pre-live` before promotion to `main`. The pre-live environment uses the pre-live Supabase database (configured via `.env.local`), which is a separate instance from the production Supabase database.

3.2.4 The `main` branch represents the production environment. Direct pushes to `main` are prohibited. Promotion from `pre-live` to `main` requires explicit authorisation from the Engineering Lead and must not be performed automatically.

3.2.5 The following pre-promotion checklist must pass on `pre-live` before any promotion to `main`:
- `yarn typescript` -- 0 errors
- `yarn lint` -- 0 errors
- `yarn test` -- 0 failures, 0 skipped
- `yarn prepare` (build) -- clean

Failure of any check is a hard stop. Changes must not be promoted to `main` with failing checks.

### 3.3 Normal Change Process

3.3.1 **Develop**: Implement the change on a feature branch. Follow existing code patterns, particularly: mandatory `organizationId` scoping in Prisma queries, RLS policy updates for any new tables, TypeScript type safety for all new data structures.

3.3.2 **Validate Locally**: Run all validation checks (`yarn typescript`, `yarn lint`, `yarn test`, `yarn prepare`). All must pass.

3.3.3 **Code Review**: Create a pull request from the feature branch to `pre-live`. At least one other engineer must review the change. The reviewer must check for: security implications (access control, data exposure), correctness of database migrations, correct retention and classification of any new data types processed.

3.3.4 **Pre-Live Deployment**: Merge to `pre-live` and verify the Vercel pre-live deployment succeeds. Manually test the changed functionality in the pre-live environment.

3.3.5 **Database Migrations (Pre-Live)**: If the change includes a database migration, apply it to the pre-live Supabase database via the Supabase SQL editor before testing on pre-live.

3.3.6 **Production Promotion**: Once pre-live validation is complete, the Engineering Lead explicitly authorises promotion to `main`. A pull request from `pre-live` to `main` is created and merged.

3.3.7 **Database Migrations (Production)**: If the change includes a database migration, apply it to the production Supabase database via the production Supabase SQL editor immediately after the Vercel production deployment completes. The migration must be recorded in the DB migration checklist in CLAUDE.md. Production is a separate Supabase instance from pre-live.

3.3.8 **Post-Deployment Verification**: Verify the production deployment is healthy via Vercel deployment status and functional testing of the changed feature.

### 3.4 Database Migration Controls

3.4.1 All database schema changes must be defined as SQL migration files in the `sql/` or `prisma/migrations/` directory of the repository before being applied to any environment.

3.4.2 Migration SQL files must be reviewed for: correctness, reversibility (where possible), impact on existing data, and security implications (particularly for RLS policy changes or new tables containing personal data).

3.4.3 Migrations must be applied to pre-live before production. Never apply a migration to production that has not been applied and validated on pre-live.

3.4.4 The pending migrations list in CLAUDE.md must be maintained accurately. All pending migrations must be identified and included in the handoff whenever a merge to `main` is planned.

3.4.5 Destructive migrations (dropping columns, dropping tables, deleting data) require explicit Engineering Lead approval and must include a documented rollback plan.

### 3.5 Emergency Change Process

3.5.1 For Critical or Major incidents requiring immediate remediation, the standard review timeline may be compressed. However, the following minimum controls must still be met:

- The change must be reviewed by at least one engineer other than the implementer, even if that review is conducted synchronously in a call.
- All automated validation checks must pass (`yarn typescript`, `yarn lint`, `yarn test`).
- The Engineering Lead must explicitly approve the change before production deployment.
- The change and its justification must be documented in the incident record within 24 hours.

3.5.2 Emergency changes must be followed up with a full post-implementation review within 5 business days.

### 3.6 Sub-Processor and Integration Changes

3.6.1 Adding a new sub-processor or third-party integration that processes personal data requires:
- Security assessment of the new sub-processor.
- Execution of a Data Processing Agreement (DPA).
- Update of the Data Classification Policy and Asset Inventory.
- Update of participant-facing privacy notices if the new processing purpose is not already disclosed.
- Written approval from the CISO.

3.6.2 Changes to OpenAI model selection or prompt templates that affect how personal data is transmitted to OpenAI must be reviewed by the Engineering Lead before deployment.

### 3.7 Rollback

3.7.1 Application rollback: Vercel allows rollback to any previous deployment. Rollback must be triggered via the Vercel dashboard by the Engineering Lead.

3.7.2 Database rollback: Database migrations are not automatically reversible. Rollback SQL must be prepared before applying any migration to production. Reversibility must be confirmed during the code review phase.

3.7.3 The decision to roll back must be documented in the change record.

---

## 4. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Engineering Lead | Approving Normal and Emergency changes for production; authorising production promotion; overseeing migration execution |
| CISO | Approving Major changes; reviewing security impact assessments; approving new sub-processor additions |
| Developers | Implementing changes on feature branches; running validation checks; writing migration files; conducting code reviews |
| All Reviewers | Checking security implications, access control correctness, and data classification in code reviews |

---

## 5. Compliance and Enforcement

Bypassing the change management process (e.g., direct push to `main`, applying unapproved migrations to production, deploying without passing validation checks) is a policy violation. All deployments to production are logged by Vercel and are subject to audit. Unapproved changes that result in a security incident or data breach will be investigated and may result in disciplinary action.

---

## 6. Review Cycle

This policy must be reviewed annually, no later than 2027-04-17, and after any change management failure that contributes to a security incident.
