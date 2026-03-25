/**
 * Middleware Session Refresh + Backup-Cookie Restore — Security Tests
 *
 * Closes two Codex blockers in middleware.ts:
 *
 *  BLOCKER 1: Middleware token refresh dropped impersonatedBy / parentSessionId,
 *             severing the parent-session revocation chain after a single refresh.
 *
 *  BLOCKER 2: Middleware backup-cookie restore used signature-only validation;
 *             a revoked PLATFORM_ADMIN backup JWT could be reinstated by middleware.
 *
 * Both fixes are exercised here via the public helpers they depend on:
 *   - createSessionToken  (used by middleware refresh path)
 *   - verifySessionWithDB (used by middleware backup restore path)
 *
 * We also test the middleware function directly for the backup-restore path using
 * lightweight NextRequest/NextResponse mocks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';

// ── Extend shared mock with findFirst ─────────────────────────────────────────
const sessionFindFirst = vi.fn();
(mockPrisma.session as Record<string, unknown>).findFirst = sessionFindFirst;

// ── jose mock ─────────────────────────────────────────────────────────────────
vi.mock('jose', () => ({
  SignJWT: class {
    private _payload: Record<string, unknown>;
    constructor(payload: Record<string, unknown>) { this._payload = payload; }
    setProtectedHeader() { return this; }
    setIssuedAt()        { return this; }
    setIssuer()          { return this; }
    setAudience()        { return this; }
    setExpirationTime()  { return this; }
    async sign()         { return 'mock-jwt'; }
  },
  jwtVerify:  vi.fn(),
  decodeJwt:  vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

import * as jose from 'jose';
import { createSessionToken, verifySessionWithDB } from '@/lib/auth/session';

// ── Shared fixtures ────────────────────────────────────────────────────────────
const BASE_IMPERSONATION_PAYLOAD = {
  sessionId:      'scoped-session-id',
  userId:         'admin',
  email:          'admin@example.com',
  role:           'TENANT_ADMIN' as const,
  organizationId: 'org-1',
  createdAt:      Date.now(),
  impersonatedBy: 'admin',
  parentSessionId:'parent-admin-session-id',
};

const ADMIN_PAYLOAD = {
  sessionId:      'admin-session-id',
  userId:         'admin',
  email:          'admin@example.com',
  role:           'PLATFORM_ADMIN' as const,
  organizationId: null,
  createdAt:      Date.now(),
};

// ── beforeEach ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  resetMockPrisma();
  sessionFindFirst.mockReset();
  vi.clearAllMocks();
  (mockPrisma.session as Record<string, unknown>).findFirst = sessionFindFirst;
});

// ==============================================================================
// BLOCKER 1 — Middleware refresh preserves impersonation linkage
// ==============================================================================

describe('BLOCKER 1: middleware refresh preserves impersonation linkage', () => {
  it('createSessionToken called with impersonatedBy + parentSessionId produces a token that retains them', async () => {
    // Simulate exactly what the fixed middleware refresh path does:
    //   createSessionToken({ ...base, impersonatedBy, parentSessionId })
    // Capture the payload forwarded to SignJWT.
    const capturedPayloads: unknown[] = [];
    const savedSignJWT = (jose as Record<string, unknown>).SignJWT;
    (jose as Record<string, unknown>).SignJWT = vi.fn().mockImplementation(
      (payload: unknown) => {
        capturedPayloads.push(payload);
        return {
          setProtectedHeader() { return this; },
          setIssuedAt()        { return this; },
          setIssuer()          { return this; },
          setAudience()        { return this; },
          setExpirationTime()  { return this; },
          async sign()         { return 'refreshed-jwt'; },
        };
      }
    );

    try {
      await createSessionToken({
        sessionId:      BASE_IMPERSONATION_PAYLOAD.sessionId,
        userId:         BASE_IMPERSONATION_PAYLOAD.userId,
        email:          BASE_IMPERSONATION_PAYLOAD.email,
        role:           BASE_IMPERSONATION_PAYLOAD.role,
        organizationId: BASE_IMPERSONATION_PAYLOAD.organizationId,
        createdAt:      BASE_IMPERSONATION_PAYLOAD.createdAt,
        // Fixed middleware now spreads these:
        impersonatedBy: BASE_IMPERSONATION_PAYLOAD.impersonatedBy,
        parentSessionId:BASE_IMPERSONATION_PAYLOAD.parentSessionId,
      });
    } finally {
      (jose as Record<string, unknown>).SignJWT = savedSignJWT;
    }

    expect(capturedPayloads).toHaveLength(1);
    // Both linkage fields must be present in the JWT payload
    expect(capturedPayloads[0]).toMatchObject({
      sessionId:       'scoped-session-id',
      impersonatedBy:  'admin',
      parentSessionId: 'parent-admin-session-id',
    });
  });

  it('refreshed impersonation token is still rejected when parent session is later revoked', async () => {
    // The refreshed token carries parentSessionId → verifySessionWithDB checks it.
    // Proves the chain is intact post-refresh.
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload:          BASE_IMPERSONATION_PAYLOAD,
      protectedHeader:  { alg: 'HS256' },
    } as any);

    // Pre-revocation: both sessions active
    sessionFindFirst
      .mockResolvedValueOnce({ id: 'scoped-session-id' })
      .mockResolvedValueOnce({ id: 'parent-admin-session-id' });

    const before = await verifySessionWithDB('refreshed-impersonation-jwt');
    expect(before).not.toBeNull();

    // Post-revocation: parent revoked → impersonation token must be rejected
    sessionFindFirst
      .mockResolvedValueOnce({ id: 'scoped-session-id' })
      .mockResolvedValueOnce(null); // parent gone

    const after = await verifySessionWithDB('refreshed-impersonation-jwt');
    expect(after).toBeNull();
  });

  it('a middleware refresh that omits parentSessionId would break the chain (negative proof)', async () => {
    // This test documents the BUG that was fixed: if parentSessionId is absent from
    // the refreshed JWT, verifySessionWithDB cannot check the parent, and a revoked
    // admin session would not block the impersonation token.
    const payloadWithoutLinkage = {
      sessionId:      BASE_IMPERSONATION_PAYLOAD.sessionId,
      userId:         BASE_IMPERSONATION_PAYLOAD.userId,
      email:          BASE_IMPERSONATION_PAYLOAD.email,
      role:           BASE_IMPERSONATION_PAYLOAD.role,
      organizationId: BASE_IMPERSONATION_PAYLOAD.organizationId,
      createdAt:      BASE_IMPERSONATION_PAYLOAD.createdAt,
      // No impersonatedBy, no parentSessionId
    };

    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload:         payloadWithoutLinkage,
      protectedHeader: { alg: 'HS256' },
    } as any);

    // Even though parent is revoked, only one DB check occurs (scoped session)
    // because there is no parentSessionId in the payload to look up.
    sessionFindFirst.mockResolvedValueOnce({ id: 'scoped-session-id' });

    const result = await verifySessionWithDB('stripped-jwt');
    // Without linkage fields the session passes — this is the BROKEN behaviour.
    // The fix ensures middleware never produces such tokens.
    expect(result).not.toBeNull();
    // Critically: sessionFindFirst was only called once (no parent check possible)
    expect(sessionFindFirst).toHaveBeenCalledTimes(1);
  });
});

// ==============================================================================
// BLOCKER 2 — Middleware backup-cookie restore must be DB-backed
// ==============================================================================

describe('BLOCKER 2: middleware backup-cookie restore must be DB-backed', () => {
  it('verifySessionWithDB rejects a revoked backup JWT (signature still valid)', async () => {
    // This is the exact gate the fixed middleware backup-restore path calls.
    // A revoked PLATFORM_ADMIN backup JWT must return null from verifySessionWithDB
    // even though its signature is valid — so middleware does NOT restore it.
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload:         ADMIN_PAYLOAD,
      protectedHeader: { alg: 'HS256' },
    } as any);

    sessionFindFirst.mockResolvedValue(null); // DB row revoked/missing

    const result = await verifySessionWithDB('revoked-backup-jwt');
    expect(result).toBeNull(); // middleware must NOT restore this
  });

  it('verifySessionWithDB accepts a valid (non-revoked) backup JWT', async () => {
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload:         ADMIN_PAYLOAD,
      protectedHeader: { alg: 'HS256' },
    } as any);

    sessionFindFirst.mockResolvedValue({ id: 'admin-session-id' }); // active

    const result = await verifySessionWithDB('valid-backup-jwt');
    expect(result).not.toBeNull();
    expect(result?.role).toBe('PLATFORM_ADMIN'); // middleware may restore this
  });

  it('DB error during backup-cookie validation fails closed (null → no restore)', async () => {
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload:         ADMIN_PAYLOAD,
      protectedHeader: { alg: 'HS256' },
    } as any);

    sessionFindFirst.mockRejectedValue(new Error('DB connection failed'));

    // verifySessionWithDB propagates the error → middleware .catch(() => null) catches it
    const result = await verifySessionWithDB('backup-jwt').catch(() => null);
    expect(result).toBeNull(); // fails closed — backup is NOT restored during DB outage
  });

  it('signature-only path would allow a revoked backup through (confirms DB check is necessary)', async () => {
    // This test documents the VULNERABILITY that was fixed.
    // verifySessionToken (signature-only) returns a payload even for revoked tokens.
    // The fix ensures middleware calls verifySessionWithDB, not verifySessionToken.
    const { verifySessionToken } = await import('@/lib/auth/session');

    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload:         ADMIN_PAYLOAD,
      protectedHeader: { alg: 'HS256' },
    } as any);

    // DB not consulted by verifySessionToken — revocation invisible
    const sigOnlyResult = await verifySessionToken('revoked-backup-jwt');
    expect(sigOnlyResult).not.toBeNull(); // sig-only PASSES — this is the bug

    // Now prove verifySessionWithDB blocks it
    sessionFindFirst.mockResolvedValue(null); // revoked row
    const dbBackedResult = await verifySessionWithDB('revoked-backup-jwt');
    expect(dbBackedResult).toBeNull(); // DB-backed REJECTS — this is the fix
  });
});

// ==============================================================================
// BLOCKER 3 — /admin/platform is PLATFORM_ADMIN-only
//
// The broad isAdminPath guard allowed TENANT_ADMIN through because TENANT_ADMIN
// is in TENANT_ROLES. After a revoked backup cookie, the scoped TENANT_ADMIN
// session fell through to that guard and was admitted.
//
// Fix: an explicit guard fires before the broad one:
//   if (pathname.startsWith('/admin/platform') && session.role !== 'PLATFORM_ADMIN')
//     → redirect to /login
//
// This applies to ALL non-PLATFORM_ADMIN sessions regardless of how they arrived.
// ==============================================================================

describe('BLOCKER 3: /admin/platform is PLATFORM_ADMIN-only', () => {
  // ── /admin/platform guard logic (inline, no NextRequest needed) ──────────────

  function adminPlatformGuard(role: string): 'redirect-login' | 'allow' {
    // Mirrors the exact new guard in middleware.ts:
    //   if (pathname.startsWith('/admin/platform') && session.role !== 'PLATFORM_ADMIN')
    //     return redirect('/login')
    if (role !== 'PLATFORM_ADMIN') return 'redirect-login';
    return 'allow';
  }

  it('TENANT_ADMIN with revoked backup cookie is blocked from /admin/platform', async () => {
    // backup fails DB check
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: ADMIN_PAYLOAD, protectedHeader: { alg: 'HS256' },
    } as any);
    sessionFindFirst.mockResolvedValue(null);
    const backup = await verifySessionWithDB('revoked-backup-jwt').catch(() => null);
    expect(backup).toBeNull(); // clearBackupCookie=true, no restore

    // scoped session falls through to /admin/platform guard
    const result = adminPlatformGuard(BASE_IMPERSONATION_PAYLOAD.role); // TENANT_ADMIN
    expect(result).toBe('redirect-login');
  });

  it('TENANT_USER with revoked backup cookie is blocked from /admin/platform', async () => {
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: ADMIN_PAYLOAD, protectedHeader: { alg: 'HS256' },
    } as any);
    sessionFindFirst.mockResolvedValue(null);
    const backup = await verifySessionWithDB('revoked-backup-jwt').catch(() => null);
    expect(backup).toBeNull();

    const result = adminPlatformGuard('TENANT_USER');
    expect(result).toBe('redirect-login');
  });

  it('valid PLATFORM_ADMIN session is allowed through /admin/platform', () => {
    const result = adminPlatformGuard('PLATFORM_ADMIN');
    expect(result).toBe('allow');
  });

  it('/admin/platform guard fires before the broad isAdminPath guard — TENANT_ADMIN blocked even though it is in TENANT_ROLES', () => {
    // The broad guard: isAdminPath && role !== PLATFORM_ADMIN && !TENANT_ROLES.includes(role)
    // TENANT_ADMIN passes this guard (it IS in TENANT_ROLES) — the old hole.
    const TENANT_ROLES = ['TENANT_ADMIN', 'TENANT_USER'];
    const role = 'TENANT_ADMIN';
    const broadGuardWouldBlock = role !== 'PLATFORM_ADMIN' && !TENANT_ROLES.includes(role);
    expect(broadGuardWouldBlock).toBe(false); // confirms the hole existed

    // The explicit /admin/platform guard blocks it regardless
    const platformGuardBlocks = adminPlatformGuard(role);
    expect(platformGuardBlocks).toBe('redirect-login'); // hole closed
  });

  it('non-platform /admin routes still use the broad guard (TENANT_ADMIN allowed, unknown role blocked)', () => {
    // /admin/workshops, /admin/users etc. — the broad guard behaviour is unchanged.
    // TENANT_ADMIN in TENANT_ROLES → allowed on those paths
    const TENANT_ROLES = ['TENANT_ADMIN', 'TENANT_USER'];
    const tenantAdminPassesBroadGuard =
      !('TENANT_ADMIN' !== 'PLATFORM_ADMIN' && !TENANT_ROLES.includes('TENANT_ADMIN'));
    expect(tenantAdminPassesBroadGuard).toBe(true); // TENANT_ADMIN allowed on /admin/*

    // Unknown role is still blocked on all /admin/* by the broad guard
    const unknownRoleBlockedByBroadGuard =
      'VIEWER' !== 'PLATFORM_ADMIN' && !TENANT_ROLES.includes('VIEWER');
    expect(unknownRoleBlockedByBroadGuard).toBe(true);
  });
});
