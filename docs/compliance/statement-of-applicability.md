# Statement of Applicability

| Field | Value |
|---|---|
| **Status** | Active |
| **Version** | 1.0 |
| **Effective Date** | 2026-04-17 |
| **Organisation** | RAISE |
| **Platform** | DREAM Discovery (multi-tenant SaaS on Next.js, Supabase, Vercel, Railway) |
| **Standard** | ISO/IEC 27001:2022 Annex A |
| **Owner** | CISO |
| **Next Review** | 2027-04-17 |

---

## Introduction

This Statement of Applicability (SOA) identifies all 93 controls from ISO/IEC 27001:2022 Annex A and declares their applicability to the DREAM Discovery platform operated by RAISE. For each control, the table records whether it is applicable, the justification specific to this platform, the current implementation status, and the responsible owner.

Controls marked "N/A" are excluded because they relate to physical activities, hardware, or operational contexts that do not apply to a fully cloud-hosted, remote-first SaaS organisation with no physical data centre footprint.

---

## A.5 Organisational Controls (37 controls)

| Ref | Control Name | Applicable | Justification | Status | Owner |
|---|---|---|---|---|---|
| A.5.1 | Policies for information security | Yes | RAISE maintains a suite of information security policies including this SOA, the Information Security Policy, and supporting policies in `docs/policies/`. | Implemented | CISO |
| A.5.2 | Information security roles and responsibilities | Yes | Engineering Lead, CISO, and Operations roles are defined with explicit security responsibilities in each policy document. | Implemented | CISO |
| A.5.3 | Segregation of duties | Partial | PLATFORM_ADMIN and tenant administrator roles are separated in the platform's RBAC model. Full segregation between deployment approval and code authorship is partially implemented via GitHub branch protection; a second-reviewer requirement is enforced on `main`. | Partial | Engineering Lead |
| A.5.4 | Management responsibilities | Yes | CISO is accountable for the ISMS; responsibilities are documented in the Information Security Policy and enforced through annual staff security reviews. | Implemented | CISO |
| A.5.5 | Contact with authorities | Yes | RAISE maintains documented contacts with the ICO (UK data protection authority) and, where relevant, law enforcement for incident reporting. | Implemented | CISO |
| A.5.6 | Contact with special interest groups | Yes | Engineering Lead subscribes to NCSC advisories, npm security advisories, GitHub Advisory Database, and Supabase security changelog. | Implemented | Engineering Lead |
| A.5.7 | Threat intelligence | Partial | Threat intelligence is gathered informally via NCSC and OWASP advisories. A formal threat intelligence programme is planned for 2026 Q3. | Partial | CISO |
| A.5.8 | Information security in project management | Yes | Security requirements (authentication, authorisation, input validation via Zod, RLS) are incorporated into feature development via pull request review checklists and the CLAUDE.md development standards. | Implemented | Engineering Lead |
| A.5.9 | Inventory of information and other associated assets | Yes | A Data Classification and Asset Inventory is maintained at `docs/compliance/asset-inventory.md` covering information, software, and cryptographic assets. | Implemented | Engineering Lead |
| A.5.10 | Acceptable use of information and other associated assets | Yes | The Acceptable Use Policy at `docs/policies/acceptable-use-policy.md` governs use of platform assets by staff and contractors. | Implemented | CISO |
| A.5.11 | Return of assets | Partial | Offboarding checklists for staff cover return of access credentials and devices. Formal documented asset return procedure is planned. | Partial | Operations |
| A.5.12 | Classification of information | Yes | Data classification scheme (Public, Internal, Confidential, Restricted) is defined in `docs/policies/data-classification-policy.md` and applied in the asset inventory. | Implemented | CISO |
| A.5.13 | Labelling of information | Partial | Data classification labels are applied at the policy and documentation level. Automated labelling of database records and storage objects is partially implemented via table-level classification in the asset inventory; inline record tagging is planned. | Partial | Engineering Lead |
| A.5.14 | Information transfer | Yes | Data transfer is limited to TLS 1.2+ on all API calls. Sub-processor Data Processing Agreements govern transfer to Supabase (EU), Vercel (global CDN), Railway (EU), and OpenAI (US). Cross-border transfer to OpenAI is covered by Standard Contractual Clauses. | Implemented | Engineering Lead |
| A.5.15 | Access control | Yes | Role-based access control is implemented at the application layer (tenant admin, facilitator, participant, PLATFORM_ADMIN). Supabase Row-Level Security policies enforce data isolation at the database layer. | Implemented | Engineering Lead |
| A.5.16 | Identity management | Yes | Supabase Auth manages user identities. PLATFORM_ADMIN accounts are provisioned manually and reviewed quarterly. Tenant user accounts are provisioned via invite flow with email verification. | Implemented | Engineering Lead |
| A.5.17 | Authentication information | Yes | Passwords are hashed by Supabase Auth (bcrypt). Password reset tokens expire after 7 days per the Data Retention Policy. MFA is supported via Supabase TOTP; enforcement for PLATFORM_ADMIN accounts is planned. | Partial | Engineering Lead |
| A.5.18 | Access rights | Yes | Access rights are assigned per role at account creation. Quarterly access reviews are conducted by the CISO to validate that rights remain appropriate. Supabase RLS policies are reviewed after schema changes. | Implemented | CISO |
| A.5.19 | Information security in supplier relationships | Yes | Vendor Management Policy at `docs/policies/vendor-management-policy.md` governs security requirements for all sub-processors. Data Processing Agreements are maintained with all processors listed in the asset inventory. | Implemented | CISO |
| A.5.20 | Addressing information security within supplier agreements | Yes | All sub-processor agreements include security and data protection obligations. DPA status is tracked in the asset inventory sub-processor register. | Implemented | CISO |
| A.5.21 | Managing information security in the ICT supply chain | Partial | npm dependency supply chain risk is managed via Dependabot and npm audit in CI. Formal supply chain risk assessment for all third-party packages beyond direct dependencies is planned for 2026 Q4. | Partial | Engineering Lead |
| A.5.22 | Monitoring, review and change management of supplier services | Yes | Provider status pages (Vercel, Supabase, Railway) are monitored. Provider security bulletins are reviewed monthly. Material changes to sub-processor services trigger a reassessment under the Vendor Management Policy. | Implemented | Operations |
| A.5.23 | Information security for use of cloud services | Yes | All cloud services (Vercel, Supabase, Railway, OpenAI) are assessed against security requirements before adoption. Responsibility boundaries are documented in the asset inventory. Shared responsibility models are acknowledged in sub-processor agreements. | Implemented | CISO |
| A.5.24 | Information security incident management planning and preparation | Yes | Incident Response Policy is maintained at `docs/policies/incident-response-policy.md`. Severity levels, response times, and escalation paths are defined. | Implemented | CISO |
| A.5.25 | Assessment and decision on information security events | Yes | Security events are assessed against the incident classification matrix in the Incident Response Policy. The Engineering Lead is the first responder for technical events; the CISO escalates to legal or regulatory authorities as required. | Implemented | Engineering Lead |
| A.5.26 | Response to information security incidents | Yes | Incident response procedures include containment, eradication, and recovery steps specific to the platform (Supabase RLS rollback, Vercel environment variable rotation, Railway service restart). | Implemented | Engineering Lead |
| A.5.27 | Learning from information security incidents | Yes | Post-incident reviews are mandatory for all P1 and P2 incidents. Findings are recorded in the risk register and tracked to resolution. | Implemented | CISO |
| A.5.28 | Collection of evidence | Yes | Audit logs (Supabase audit log tables, Vercel log drain) are retained for 2 years. Log integrity is protected by restricting deletion to CISO-approved operations only. | Implemented | Engineering Lead |
| A.5.29 | Information security during disruption | Partial | Supabase point-in-time recovery and daily backups provide data resilience. A formal business continuity plan covering DREAM Discovery is documented in the Backup and Recovery Policy; a full BCP test has not yet been conducted. | Partial | Engineering Lead |
| A.5.30 | ICT readiness for business continuity | Partial | RPO and RTO targets are defined in the Backup and Recovery Policy. Failover to Supabase read replicas is not yet configured; this is a planned enhancement for 2026 Q3. | Partial | Engineering Lead |
| A.5.31 | Legal, statutory, regulatory and contractual requirements | Yes | Legal register is maintained by the CISO covering UK GDPR, DPA 2018, and contractual obligations to enterprise tenants. Compliance obligations are reviewed annually. | Implemented | CISO |
| A.5.32 | Intellectual property rights | Yes | All platform code is proprietary to RAISE. Open-source licence compliance is reviewed during dependency management; licences incompatible with commercial SaaS are blocked. | Implemented | Engineering Lead |
| A.5.33 | Protection of records | Yes | Audit logs and compliance records are retained per the Data Retention and Deletion Policy. Deletion of audit logs requires CISO approval. Backups are encrypted at rest. | Implemented | Engineering Lead |
| A.5.34 | Privacy and protection of PII | Yes | Privacy Notice is published and accessible to all data subjects. UK GDPR obligations are integrated into platform design (data minimisation, retention limits, right-to-erasure tooling). A Data Protection Impact Assessment has been conducted for AI synthesis processing. | Implemented | CISO |
| A.5.35 | Independent review of information security | Planned | Annual penetration testing by an accredited third party is planned for 2026 Q4. Internal ISMS review is conducted annually by the CISO. | Planned | CISO |
| A.5.36 | Compliance with policies, rules and standards for information security | Yes | Policy compliance is reviewed in quarterly internal audits. Technical controls (lint, TypeScript, CodeQL) enforce coding standards in CI. | Implemented | CISO |
| A.5.37 | Documented operating procedures | Yes | Operating procedures are documented in `CLAUDE.md`, the deploy workflow in `MEMORY.md`, and runbooks in `docs/`. Incident response procedures are documented in the Incident Response Policy. | Implemented | Engineering Lead |

---

## A.6 People Controls (8 controls)

| Ref | Control Name | Applicable | Justification | Status | Owner |
|---|---|---|---|---|---|
| A.6.1 | Screening | Yes | Background checks are conducted for all staff and contractors with access to production systems, proportionate to role sensitivity. PLATFORM_ADMIN access requires enhanced screening. | Implemented | Operations |
| A.6.2 | Terms and conditions of employment | Yes | Employment contracts include information security responsibilities, confidentiality obligations, and acceptable use requirements. | Implemented | Operations |
| A.6.3 | Information security awareness, education and training | Partial | Security awareness is communicated via policy documentation and onboarding. A formal annual security training programme is planned for 2026 Q3. | Partial | CISO |
| A.6.4 | Disciplinary process | Yes | Violations of information security policies are subject to disciplinary action as defined in employment terms and referenced in the Acceptable Use Policy. | Implemented | Operations |
| A.6.5 | Responsibilities after termination or change of employment | Yes | Offboarding checklist covers revocation of GitHub access, Supabase access, Vercel team membership, Railway access, and all other system accounts within 1 business day of termination. | Implemented | Operations |
| A.6.6 | Confidentiality or non-disclosure agreements | Yes | NDAs are in place with all staff and contractors with access to tenant data or platform source code. | Implemented | Operations |
| A.6.7 | Remote working | Yes | All RAISE personnel work remotely. Remote working security requirements (encrypted storage, VPN for sensitive operations, screen lock policies) are defined in the Acceptable Use Policy. | Implemented | CISO |
| A.6.8 | Information security event reporting | Yes | All staff are required to report suspected security events to the Engineering Lead or CISO immediately via the defined incident reporting channel. Reporting obligations are included in employment terms. | Implemented | CISO |

---

## A.7 Physical Controls (14 controls)

| Ref | Control Name | Applicable | Justification | Status | Owner |
|---|---|---|---|---|---|
| A.7.1 | Physical security perimeters | N/A | RAISE has no physical data centres or server rooms. All infrastructure is hosted on managed cloud services (Vercel, Supabase, Railway). Physical security of underlying data centres is the responsibility of the respective cloud providers. | N/A | Operations |
| A.7.2 | Physical entry | N/A | No RAISE-controlled physical facilities house information processing assets. Physical entry controls are the responsibility of cloud providers. | N/A | Operations |
| A.7.3 | Securing offices, rooms and facilities | Partial | RAISE staff work from home. Security of home offices is covered by the Remote Working section of the Acceptable Use Policy, including screen lock requirements and visitor policies for calls involving tenant data. | Partial | CISO |
| A.7.4 | Physical security monitoring | N/A | No RAISE-controlled physical facilities to monitor. Cloud provider physical security monitoring is covered by their respective compliance certifications (SOC 2, ISO 27001). | N/A | Operations |
| A.7.5 | Protecting against physical and environmental threats | N/A | Physical and environmental threats to infrastructure are managed by cloud providers. RAISE mitigates logical equivalents (service outages) via multi-region Vercel deployment and Supabase PITR. | N/A | Engineering Lead |
| A.7.6 | Working in secure areas | Partial | Home office working security requirements are defined in the Acceptable Use Policy. Staff are prohibited from processing Restricted data in public locations without a VPN and privacy screen. | Partial | CISO |
| A.7.7 | Clear desk and screen | Yes | Clear screen policy is enforced: automatic screen lock is required after 5 minutes of inactivity on all devices used to access production systems. Clear desk is required for remote working environments as defined in the Acceptable Use Policy. | Implemented | CISO |
| A.7.8 | Equipment siting and protection | Partial | Staff are required to use encrypted storage on all devices that access production systems. Full-disk encryption (FileVault for macOS, BitLocker for Windows) is a documented requirement; enforcement via MDM is planned. | Partial | Operations |
| A.7.9 | Security of assets off-premises | Partial | Laptops and mobile devices used off-premises must have full-disk encryption and a PIN/password. Remote wipe capability via MDM is planned for 2026 Q3. | Partial | Operations |
| A.7.10 | Storage media | Partial | Production data must not be stored on removable media. Cloud storage (Google Drive, Supabase Storage) is used for all data. Formal removable media policy is included in the Acceptable Use Policy; enforcement is partially manual. | Partial | CISO |
| A.7.11 | Supporting utilities | N/A | Supporting utilities (power, cooling) for the platform's infrastructure are managed entirely by Vercel, Supabase, and Railway. RAISE has no direct control over or responsibility for these utilities. | N/A | Operations |
| A.7.12 | Cabling security | N/A | RAISE operates no physical cabling infrastructure. Network communications are entirely cloud-based. | N/A | Operations |
| A.7.13 | Equipment maintenance | Partial | Staff are responsible for maintaining the operational security of personal devices used for work. Formal device maintenance and end-of-life policy is planned as part of the MDM rollout in 2026 Q3. | Partial | Operations |
| A.7.14 | Secure disposal or re-use of equipment | Partial | Staff are required to perform a certified wipe of any device used to access production systems before disposal or reassignment. A documented secure disposal procedure is planned for 2026 Q3. | Partial | Operations |

---

## A.8 Technological Controls (34 controls)

| Ref | Control Name | Applicable | Justification | Status | Owner |
|---|---|---|---|---|---|
| A.8.1 | User endpoint devices | Partial | Acceptable Use Policy defines endpoint security requirements (encryption, screen lock, patched OS). MDM enforcement is planned; currently relies on attestation at onboarding. | Partial | Operations |
| A.8.2 | Privileged access rights | Yes | PLATFORM_ADMIN accounts are a distinct role in the application with elevated privileges. These accounts are issued only to named RAISE staff, reviewed quarterly, and access is logged in the audit trail. Supabase service role keys are stored only in server-side environment variables. | Implemented | Engineering Lead |
| A.8.3 | Information access restriction | Yes | Supabase Row-Level Security policies enforce that each tenant can only access their own data. Application-layer middleware validates tenant context on every authenticated request. Regular RLS policy reviews are conducted after schema changes. | Implemented | Engineering Lead |
| A.8.4 | Access to source code | Yes | Source code access is controlled via GitHub repository permissions. Only named engineers have write access to the `Andrewghall/Dream_discovery` repository. All changes require pull request review. | Implemented | Engineering Lead |
| A.8.5 | Secure authentication | Yes | Authentication is provided by Supabase Auth using industry-standard JWT tokens with sliding expiry. Password reset tokens expire after 7 days. Supabase TOTP MFA is supported; PLATFORM_ADMIN MFA enforcement is a planned control. | Partial | Engineering Lead |
| A.8.6 | Capacity management | Yes | Vercel auto-scales serverless functions. Supabase connection pooling (PgBouncer) is configured. Railway CaptureAPI is monitored for resource utilisation. Capacity planning is reviewed when onboarding enterprise tenants above a defined participant threshold. | Implemented | Engineering Lead |
| A.8.7 | Protection against malware | Yes | Dependabot and npm audit in CI scan for known malicious or vulnerable packages. CodeQL SAST detects code patterns consistent with injected malicious code. No client-side binary execution occurs; the platform is a web application. | Implemented | Engineering Lead |
| A.8.8 | Management of technical vulnerabilities | Yes | Covered by the Vulnerability Management Policy at `docs/policies/vulnerability-management-policy.md`. Dependabot weekly scans, CodeQL on every PR, npm audit at high/critical in CI. | Implemented | Engineering Lead |
| A.8.9 | Configuration management | Yes | Infrastructure configuration is managed as code (Vercel project settings, Supabase schema via Prisma migrations, Railway service configuration). Environment variables containing secrets are stored in Vercel and Railway secret stores, not in source code. | Implemented | Engineering Lead |
| A.8.10 | Information deletion | Yes | Data deletion mechanisms are defined in the Data Retention and Deletion Policy, implemented via the `/api/cron/retention` job, admin deletion UI, and GDPR erasure process. Voice recordings are hard-deleted within 7 days. | Implemented | Engineering Lead |
| A.8.11 | Data masking | Partial | Participant email addresses are not surfaced in workshop output exports. Full data masking (tokenisation or pseudonymisation) for analytics events is partially implemented; a comprehensive masking layer for reporting is planned. | Partial | Engineering Lead |
| A.8.12 | Data leakage prevention | Partial | Server-side rendering (Next.js) ensures that Supabase service role keys and OpenAI API keys are never exposed to client-side code. Environment variable audit in CI checks for accidental secret exposure. Full DLP tooling is not yet implemented. | Partial | Engineering Lead |
| A.8.13 | Information backup | Yes | Supabase provides automated daily backups with point-in-time recovery (PITR) to a minimum of 7 days. Backup configuration and recovery procedures are documented in the Backup and Recovery Policy. | Implemented | Engineering Lead |
| A.8.14 | Redundancy of information processing facilities | Partial | Vercel deploys to multiple edge regions globally. Supabase is deployed in a single AWS region (eu-west-2) with PITR for recovery. Multi-region Supabase read replicas are a planned enhancement for 2026 Q3. | Partial | Engineering Lead |
| A.8.15 | Logging | Yes | Application events (authentication, admin actions, cron execution) are logged to `analytics_events`. Vercel log drain captures edge function and API route logs. Railway logs CaptureAPI output. All logs are retained for 2 years. | Implemented | Engineering Lead |
| A.8.16 | Monitoring activities | Yes | Vercel monitoring dashboards track error rates and p99 latency. Supabase dashboard monitors query performance and connection counts. Upstash monitors rate-limiting counters. Alerts are configured for anomalous error rates. | Implemented | Operations |
| A.8.17 | Clock synchronisation | Yes | All platform components use UTC timestamps sourced from their respective cloud provider NTP infrastructure. Database timestamps use `TIMESTAMPTZ` to ensure timezone correctness. Clock synchronisation is managed by Vercel, Supabase, and Railway. | Implemented | Engineering Lead |
| A.8.18 | Use of privileged utility programs | Yes | Direct database access (Supabase SQL editor, psql) is restricted to the Engineering Lead and CISO. All such access is logged by Supabase. Utility access is used only for approved maintenance tasks. | Implemented | Engineering Lead |
| A.8.19 | Installation of software on operational systems | Yes | Software installation on production infrastructure is controlled via CI/CD pipelines (GitHub Actions deploying to Vercel and Railway). Direct deployment to production outside of the CI pipeline is prohibited. | Implemented | Engineering Lead |
| A.8.20 | Networks security | Yes | All external communications use TLS 1.2 or higher. Supabase enforces SSL on all database connections. Vercel enforces HTTPS. Internal service-to-service calls (Next.js API routes to Supabase, CaptureAPI to Supabase) use authenticated, encrypted channels. | Implemented | Engineering Lead |
| A.8.21 | Security of network services | Yes | Network security for cloud services is governed by the respective provider SLAs and security certifications. RAISE uses Vercel WAF and rate limiting (Upstash) to protect API endpoints from abuse and DDoS. | Implemented | Engineering Lead |
| A.8.22 | Segregation of networks | Partial | Application environments (pre-live, production) are segregated via separate Vercel deployments with separate environment variables and separate Supabase project instances. Full network-level segmentation (VPC peering) is not implemented in the current serverless architecture. | Partial | Engineering Lead |
| A.8.23 | Web filtering | Partial | The platform does not provide general internet access to staff via a managed proxy. Web filtering for endpoint devices is a planned MDM control. CodeQL and Dependabot scan imported code for unsafe URL patterns. | Partial | Operations |
| A.8.24 | Use of cryptography | Yes | Cryptographic controls are documented in the asset inventory. TLS 1.2+ for data in transit; AES-256 encryption at rest (provided by Supabase, Vercel, and Railway). JWT signing uses RS256 (Supabase Auth). Cryptographic key management follows the key inventory in the asset inventory. | Implemented | Engineering Lead |
| A.8.25 | Secure development lifecycle | Yes | Secure development practices are enforced via: CodeQL SAST on every PR, npm audit in CI, TypeScript strict mode, Zod input validation on all API routes, and mandatory pull request review. The CLAUDE.md development standards document secure coding expectations. | Implemented | Engineering Lead |
| A.8.26 | Application security requirements | Yes | Security requirements (authentication, authorisation, input validation, output encoding, CSRF protection) are defined as acceptance criteria for feature development. OWASP Top 10 is used as a reference framework during design review. | Implemented | Engineering Lead |
| A.8.27 | Secure system architecture and engineering principles | Yes | The platform uses a server-side rendering architecture (Next.js) to minimise client-side secret exposure. Supabase RLS provides defence-in-depth at the data layer. Zod schemas validate all API inputs. Principle of least privilege is applied to all service accounts. | Implemented | Engineering Lead |
| A.8.28 | Secure coding | Yes | Secure coding standards are embedded in the CLAUDE.md development guide: no hardcoded secrets, Zod validation on all API routes, parameterised queries via Prisma ORM, content security policy headers on all responses. | Implemented | Engineering Lead |
| A.8.29 | Security testing in development and testing | Yes | Automated security testing via CodeQL and npm audit runs on every PR. Manual security review is conducted for high-risk features (authentication changes, new data processing, PLATFORM_ADMIN functionality). Annual penetration testing is planned. | Partial | Engineering Lead |
| A.8.30 | Outsourced development | Partial | External contractors are subject to the same secure development standards as internal staff, enforced via the same GitHub PR review and CI pipeline. A formal outsourced development security addendum is planned for inclusion in contractor agreements. | Partial | Engineering Lead |
| A.8.31 | Separation of development, test and production environments | Yes | Three environments are maintained: local development, `pre-live` (Vercel branch deployment connected to the pre-live Supabase project), and `main` (production Vercel deployment connected to the production Supabase project). Production environment variables and database credentials are not accessible in development or pre-live. | Implemented | Engineering Lead |
| A.8.32 | Change management | Yes | All changes to production are made via pull requests on GitHub, require at least one approving review, must pass all CI checks (TypeScript, lint, tests, CodeQL, npm audit), and are deployed via the documented deploy workflow. The Change Management Policy is at `docs/policies/change-management-policy.md`. | Implemented | Engineering Lead |
| A.8.33 | Test information | Yes | Synthetic and seeded snapshot data is used for testing. Production data is never copied to development or pre-live environments. The retail snapshot in `scripts/seed-retail-snapshot.ts` uses fabricated participant data. | Implemented | Engineering Lead |
| A.8.34 | Protection of information systems during audit testing | Yes | Penetration testing and audit activities are conducted against the `pre-live` environment, not production, unless the scope of the engagement specifically requires production testing and explicit CISO approval is obtained. | Implemented | CISO |

---

## Summary Statistics

| Domain | Total Controls | Implemented | Partial | Planned | N/A |
|---|---|---|---|---|---|
| A.5 Organisational | 37 | 27 | 7 | 2 | 1 |
| A.6 People | 8 | 7 | 1 | 0 | 0 |
| A.7 Physical | 14 | 2 | 5 | 0 | 7 |
| A.8 Technological | 34 | 23 | 10 | 1 | 0 |
| **Total** | **93** | **59** | **23** | **3** | **8** |

---

## Version History

| Version | Date | Author | Summary of Changes |
|---|---|---|---|
| 1.0 | 2026-04-17 | CISO | Initial release covering all 93 Annex A controls |
