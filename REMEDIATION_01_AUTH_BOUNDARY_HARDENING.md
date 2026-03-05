# Remediation 01: Auth Boundary Hardening

## Objective
Close the highest-risk authorization gaps in participant-facing endpoints so session data and report generation cannot be accessed or mutated by unauthorized callers.

## Risk Summary
- Severity: Critical
- Primary risk: Unauthorized access to participant data and report workflows via weak endpoint authorization.
- Impacted surfaces:
  - `/api/conversation/report`
  - `/api/conversation/update-preferences`
  - `/api/test-email`

## Scope
### In Scope
1. Add strict authorization checks for participant conversation/report APIs.
2. Ensure session ownership validation for all mutating participant endpoints.
3. Remove or restrict public test-email endpoint access.
4. Add regression tests that prove unauthorized calls fail.

### Out of Scope
1. Session revocation model redesign (tracked separately).
2. Tenant role policy redesign.
3. Rate limiter backend migration.

## Current Weaknesses
1. `GET /api/conversation/report` accepts `sessionId` without participant/session auth.
2. `POST /api/conversation/update-preferences` mutates by `sessionId` without proof of ownership.
3. `GET /api/test-email` is callable without authentication.

## Implementation Plan
1. Introduce a shared participant auth helper:
   - Validate workshop+participant token or signed participant session cookie.
   - Resolve authorized `participantId` and `sessionId` pair.
2. Update `/api/conversation/report`:
   - Require valid participant auth context.
   - Reject mismatched `sessionId`/participant pairs with `403`.
   - Remove report access by raw `sessionId` alone.
3. Update `/api/conversation/update-preferences`:
   - Require participant auth.
   - Allow updates only for the authenticated participant's current session.
4. Update `/api/test-email`:
   - Restrict to authenticated platform admins only, or remove in production builds.
5. Add integration tests:
   - Unauthorized report request returns `401`.
   - Authorized participant cannot read another participant's report (`403`).
   - Unauthorized preference update returns `401`.
   - Unauthorized test-email request returns `401`/`403`.

## Acceptance Criteria
1. No conversation/report endpoint accepts a bare `sessionId` without participant auth.
2. Cross-participant report access is blocked with `403`.
3. Public test-email triggering is blocked.
4. Automated tests fail if auth checks are removed.

## Rollout Notes
1. Backward compatibility:
   - Frontend discovery page may need to include participant token in report/preferences calls.
2. Monitoring:
   - Log auth failures with request path and hashed identifiers.
3. Deployment:
   - Deploy with tests in CI.
   - Verify happy-path participant flow in staging before production.

## Verification Checklist
- [ ] Unauthorized report request blocked.
- [ ] Unauthorized preferences update blocked.
- [ ] Unauthorized test email blocked.
- [ ] Valid participant still completes report flow.
- [ ] CI integration tests passing.
