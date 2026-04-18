# Incident Response Policy

| Field | Value |
|---|---|
| Status | Active |
| Version | 1.0 |
| Effective Date | 2026-04-17 |
| Owner | CISO / Engineering Lead |
| Review Date | 2027-04-17 |

---

## 1. Purpose

This policy defines the process for detecting, reporting, classifying, containing, eradicating, recovering from, and reviewing security incidents affecting the DREAM Discovery platform. Given that DREAM Discovery processes personal data including voice recordings and participant PII, a rapid and well-coordinated incident response capability is essential to meet the 72-hour GDPR breach notification obligation and to minimise harm to data subjects and tenant organisations.

---

## 2. Scope

This policy applies to all security and privacy incidents affecting DREAM Discovery, including incidents in sub-processor environments (Vercel, Supabase, Railway, OpenAI) that affect RAISE's ability to protect participant data. It applies to all RAISE personnel, contractors, and sub-processors who have a responsibility to report or respond to incidents.

---

## 3. Incident Classification

### 3.1 Severity Levels

| Severity | Description | Examples |
|---|---|---|
| Critical | Confirmed or highly probable personal data breach; active exploitation; system-wide service loss | Cross-tenant data exposure via missing RLS policy; Supabase service role key leak; active ransomware; participant PII accessible without authentication |
| Major | Significant security control failure with potential for data exposure; partial service degradation affecting multiple tenants | Authentication bypass discovered; API route returning cross-tenant data (not yet confirmed exploited); Railway CaptureAPI unavailable for more than 2 hours |
| Moderate | Security weakness identified without confirmed exploitation; single-tenant service disruption; suspicious access pattern | Dependency vulnerability with known CVE in production build; unusual access volume from single user; DDoS probe without successful service impact |
| Minor | Low-impact anomaly or policy violation with no data exposure risk | Single failed login spike; non-sensitive misconfiguration; policy non-compliance by internal staff |

### 3.2 Personal Data Breach Definition

Under GDPR, a personal data breach is any security incident leading to accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data processed by DREAM Discovery. All Critical and Major incidents must be assessed against this definition immediately.

---

## 4. Policy Statement

### 4.1 Detection and Reporting

4.1.1 Any person (RAISE employee, contractor, or sub-processor) who suspects or discovers a security incident must report it to the Engineering Lead within 1 hour of discovery. The report must include: date and time of discovery, nature of the incident (what was observed), affected systems or data, and any immediate actions already taken.

4.1.2 Automated monitoring must be in place to detect anomalies including: repeated authentication failures, cross-tenant data access attempts logged at the application layer, unexpected bulk data exports, and abnormal Railway CaptureAPI ingestion volumes.

4.1.3 Sub-processors (Vercel, Supabase, Railway, OpenAI) must notify RAISE of any incident affecting DREAM Discovery data in accordance with their DPA obligations and RAISE's contractual requirements.

### 4.2 Initial Assessment (within 2 hours)

4.2.1 The Engineering Lead must assign a severity level within 2 hours of receiving an incident report.

4.2.2 For Critical or Major incidents, the Engineering Lead must immediately:
- Convene an incident response team.
- Initiate the containment phase.
- Begin the 72-hour GDPR notification clock if personal data may be involved.
- Notify the CISO.

4.2.3 The incident must be logged in the incident register with: incident ID, date/time reported, date/time of suspected occurrence, severity, affected systems, initial description, and assigned responder.

### 4.3 Containment

4.3.1 Containment actions must be taken as quickly as possible to prevent further harm. Containment must not wait for full root cause analysis.

4.3.2 Containment actions specific to DREAM Discovery may include:

- Revoking a compromised Supabase service role key and issuing a replacement immediately via the Supabase dashboard, followed by redeployment to Vercel with the new key.
- Disabling a compromised user account via Supabase Auth admin functions.
- Deploying an emergency hotfix to the `pre-live` branch and promoting to `main` under the emergency change procedure (see Change Management Policy).
- Contacting Railway to suspend the CaptureAPI service if a voice ingestion pipeline compromise is confirmed.
- Revoking the OpenAI API key and issuing a replacement if prompt injection or API key exposure is suspected.
- Applying a temporary Supabase RLS policy to block a specific query pattern while a permanent fix is developed.

4.3.3 Evidence must be preserved before containment actions are taken where possible (e.g., export of relevant Vercel logs, Supabase audit logs, and analytics_events records before credentials are rotated).

### 4.4 Eradication

4.4.1 Once containment is achieved, the root cause must be identified and eliminated. Eradication must not be declared complete until the specific vulnerability, misconfiguration, or compromised credential that enabled the incident has been removed from all environments.

4.4.2 Eradication for code-level issues (e.g., missing `organizationId` scope on a query, missing RLS policy) requires a code fix committed to the `pre-live` branch, passing all validation checks (TypeScript, ESLint, tests), and explicit promotion to `main`.

4.4.3 All affected encryption keys, session tokens, and API credentials must be rotated as part of eradication. Rotation must be verified to have taken effect before declaring eradication complete.

### 4.5 Recovery

4.5.1 Recovery involves restoring full service from a known-good state. Vercel deployments can be rolled back to any previous deployment via the Vercel dashboard. The Engineering Lead must confirm the rollback target is not itself affected by the vulnerability.

4.5.2 Database recovery must follow the Backup and Recovery Policy. Point-in-time recovery of the Supabase production database requires access to the production Supabase project, which is separate from the pre-live project.

4.5.3 Tenant organisations affected by a confirmed incident must be notified of the nature of the incident, the data involved, the containment and recovery actions taken, and any recommended actions for the tenant organisation (e.g., password reset, review of exported data).

### 4.6 GDPR Notification Obligations

4.6.1 For any confirmed personal data breach, RAISE must notify the relevant supervisory authority (UK ICO for UK-based operations) within 72 hours of becoming aware of the breach, unless the breach is unlikely to result in risk to individuals' rights and freedoms.

4.6.2 The notification to the supervisory authority must include: nature of the breach (categories and approximate number of data subjects affected), contact details of the Data Protection Officer or Engineering Lead, likely consequences of the breach, measures taken or proposed to address the breach.

4.6.3 If the breach is likely to result in a high risk to data subjects, those individuals must be notified directly without undue delay. The Engineering Lead and CISO must make this determination together.

4.6.4 The 72-hour clock starts when RAISE becomes aware of the breach. Awareness includes notification from a sub-processor.

### 4.7 Post-Incident Review

4.7.1 A post-incident review (PIR) must be conducted within 5 business days of incident closure for Critical and Major incidents, and within 10 business days for Moderate incidents.

4.7.2 The PIR must document: timeline of events, root cause, effectiveness of detection and response, actions taken, data subjects or tenant organisations affected, regulatory notifications made, and preventive measures to avoid recurrence.

4.7.3 Preventive measures identified in the PIR must be assigned to a named owner with a target completion date and tracked to closure.

4.7.4 PIR outputs must feed into the annual risk register review.

---

## 5. Incident Response Contacts

| Role | Responsibility in Incident |
|---|---|
| Engineering Lead | Incident Commander for all Critical and Major incidents; 24/7 on-call for Critical incidents |
| CISO | Notified immediately for Critical incidents; approves regulatory notifications |
| Legal / DPO | Engaged for all potential personal data breaches; advises on notification obligations |
| Sub-Processor Security Contacts | Engaged as required; DPA obligations govern their response timelines |

---

## 6. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Engineering Lead | Severity classification, containment coordination, GDPR notification decision, PIR facilitation |
| CISO | Policy ownership, regulatory liaison, approval of external notifications |
| All Staff | Immediate reporting of suspected incidents, evidence preservation, cooperation with response |
| Sub-Processors | Contractual notification obligations per DPA, cooperation with RAISE investigation |

---

## 7. Compliance and Enforcement

Failure to report a suspected incident promptly constitutes a policy violation. Deliberate concealment of an incident that later proves to be a personal data breach will be treated as gross misconduct. RAISE accepts that failure to notify the ICO within 72 hours of a reportable breach may result in regulatory enforcement action.

---

## 8. Review Cycle

This policy must be reviewed annually, no later than 2027-04-17, and after every Critical or Major incident. The incident register must be reviewed at least quarterly.
