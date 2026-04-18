# Acceptable Use Policy

| Field | Value |
|---|---|
| Status | Active |
| Version | 1.0 |
| Effective Date | 2026-04-17 |
| Owner | CISO / Engineering Lead |
| Review Date | 2027-04-17 |

---

## 1. Purpose

This policy defines acceptable and unacceptable use of DREAM Discovery systems, infrastructure, and data by RAISE employees, contractors, and authorised users. Because DREAM Discovery processes personal data of workshop participants on behalf of tenant organisations, misuse of systems or data carries legal, regulatory, and reputational consequences for RAISE and for the affected data subjects.

---

## 2. Scope

This policy applies to all persons who access DREAM Discovery systems in any capacity, including: RAISE employees and contractors, tenant administrator accounts, facilitator accounts, and any third party granted temporary access for support or audit purposes. It covers access to the DREAM Discovery web application, Vercel dashboard, Supabase dashboard, Railway dashboard, GitHub repository, and any local development environment containing copies of application code or data.

---

## 3. Policy Statement

### 3.1 Acceptable Use of the DREAM Discovery Application

3.1.1 DREAM Discovery may be used only for its intended purpose: facilitating structured discovery workshops, processing participant inputs, generating AI-assisted insights, and producing organisational intelligence outputs for the benefit of the subscribing tenant organisation.

3.1.2 Users may access only data and features within their assigned role and organisation scope. Any attempt to access data belonging to another tenant organisation is strictly prohibited, regardless of technical feasibility.

3.1.3 Facilitators and tenant administrators must obtain valid, informed consent from workshop participants before collecting voice recordings or other personal data. Consent must be recorded and retained in accordance with the Data Retention and Deletion Policy.

3.1.4 AI-generated synthesis outputs, facilitation guidance, and output intelligence produced by DREAM Discovery must not be used to make automated decisions about individuals without human review, in compliance with GDPR Article 22.

3.1.5 Workshop data and participant information must be used only for the purposes disclosed to participants at the time of collection. Using participant data for purposes beyond the original scope (e.g., marketing, external research, profiling) is prohibited without fresh consent and RAISE's written authorisation.

### 3.2 Acceptable Use of Engineering Systems

3.2.1 RAISE engineers may access the GitHub repository, Vercel dashboard, Supabase dashboard, and Railway dashboard only for legitimate development, deployment, maintenance, or security purposes.

3.2.2 Production database access (Supabase production SQL editor or direct psql connection) is a privileged operation governed by the Access Control Policy. It must not be used to browse participant data out of curiosity or for any purpose beyond the specific, documented task being performed.

3.2.3 Engineers must not use their elevated system access to extract, copy, or transmit any participant PII, voice recording, transcript, or workshop output to any system or service not listed as an approved sub-processor.

3.2.4 The `main` branch of the GitHub repository must not be directly pushed to. All changes must follow the branch protection and review process defined in the Change Management Policy.

3.2.5 Secrets (Supabase service role keys, OpenAI API keys, Railway tokens, database connection strings) must never be committed to the repository, shared over messaging platforms, or stored in plain text on workstations.

### 3.3 Unacceptable Use

The following uses are explicitly prohibited and may result in disciplinary action, termination, or legal proceedings:

3.3.1 Attempting to access, query, or extract data from a tenant organisation other than the one for which the user has authorised access.

3.3.2 Attempting to bypass, disable, or circumvent any security control including Supabase RLS policies, application-layer `organizationId` scoping, session authentication, or MFA requirements.

3.3.3 Using DREAM Discovery infrastructure (Vercel compute, Railway services) for any purpose other than operating the DREAM Discovery platform (e.g., cryptocurrency mining, hosting unrelated services, running unauthorised scripts).

3.3.4 Accessing or copying personal data (participant PII, voice recordings, transcripts) for personal use, commercial gain outside of RAISE's business, or to share with unauthorised parties.

3.3.5 Deliberately introducing vulnerabilities into the codebase, including removing input validation, disabling RLS policies, or hardcoding credentials.

3.3.6 Using RAISE email addresses, credentials, or system access to represent RAISE or commit RAISE to legal or financial obligations without explicit authorisation.

3.3.7 Connecting the DREAM Discovery platform or its sub-processor integrations to any additional third-party service, AI model, or API that processes personal data without prior approval from the Engineering Lead and CISO, and without ensuring a DPA is in place.

3.3.8 Sharing Supabase dashboard access, Vercel team seats, or Railway access with individuals not formally provisioned under the Access Control Policy.

### 3.4 Personal Device and Remote Access

3.4.1 Engineers accessing DREAM Discovery systems from personal devices must ensure those devices have full-disk encryption enabled, up-to-date operating system and security patches, and approved antivirus/endpoint protection.

3.4.2 Local development environments must not persist production data. Engineers must use seeded development data (e.g., `scripts/seed-retail-snapshot.ts` data) and must not restore production database snapshots to local machines.

3.4.3 Accessing DREAM Discovery systems or participant data over public unsecured Wi-Fi without VPN protection is prohibited.

### 3.5 AI Tool Usage

3.5.1 RAISE engineers using AI coding assistants (including Claude Code, GitHub Copilot, or similar tools) must not paste, share, or otherwise input: production database credentials, participant PII, voice recording content, transcript text, or any data classified as Confidential or Restricted under the Data Classification Policy.

3.5.2 Code suggestions from AI assistants must be reviewed for security implications before being committed, particularly for any code that handles authentication, session management, data access, or encryption.

---

## 4. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| CISO | Policy ownership, monitoring for policy violations, disciplinary escalation |
| Engineering Lead | Enforcing technical controls that prevent prohibited uses, reviewing access logs |
| All Staff and Contractors | Adhering to this policy, reporting suspected violations to the Engineering Lead |
| Tenant Administrators | Ensuring their facilitators and participants understand the acceptable use constraints relevant to them |

---

## 5. Compliance and Enforcement

Violation of this policy may result in immediate suspension of system access, disciplinary action up to and including termination, and referral to legal authorities where applicable. RAISE monitors system access and reserves the right to audit access logs, query logs, and deployment activity in relation to suspected violations. All users are on notice that their activity within DREAM Discovery systems is logged.

---

## 6. Review Cycle

This policy must be reviewed annually, no later than 2027-04-17.
