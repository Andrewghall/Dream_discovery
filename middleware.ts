import { NextRequest, NextResponse } from 'next/server';
import { verifySessionWithDB, createSessionToken } from '@/lib/auth/session';
import { verifyExecSessionWithDB } from '@/lib/auth/exec-session';
import * as jose from 'jose';
import { apiLimiter } from '@/lib/rate-limit';

// Node.js runtime so Prisma DB session checks work in middleware
export const runtime = 'nodejs';

const TENANT_ROLES = ['TENANT_ADMIN', 'TENANT_USER'];
const REFRESH_WINDOW_MS = 2 * 60 * 60 * 1000; // Refresh if within 2 hours of expiry

// ── Admin API rate limiting ────────────────────────────────────────────────────
// Applied globally to all /api/admin/* requests before route handlers are reached.
// Limit: 120 requests per minute per IP (generous for normal use; blocks scripted abuse).
// ISO 27001 A.8.6 / SOC 2 CC6.6 — capacity management and access protection.

const ADMIN_API_RATE_LIMIT = 120; // requests per minute

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

async function checkAdminApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith('/api/admin/')) return null;
  const ip = getClientIp(request);
  const result = await apiLimiter.check(ADMIN_API_RATE_LIMIT, `admin-api:${ip}`).catch(() => null);
  if (result && !result.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: { 'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString() },
      }
    );
  }
  return null;
}

async function getSessionFromRequest(request: NextRequest) {
  const cookie = request.cookies.get('session');
  if (!cookie?.value) return null;
  try {
    // DB-backed: rejects revoked/expired DB sessions for non-admin users
    return await verifySessionWithDB(cookie.value);
  } catch {
    return null;
  }
}

/**
 * Check if the JWT is within REFRESH_WINDOW_MS of its expiration.
 * Returns the raw token string so we can decode the `exp` claim.
 */
function shouldRefreshToken(request: NextRequest): boolean {
  const cookie = request.cookies.get('session');
  if (!cookie?.value) return false;
  try {
    const decoded = jose.decodeJwt(cookie.value);
    if (!decoded.exp) return false;
    const expiresAt = decoded.exp * 1000; // seconds -> ms
    return expiresAt - Date.now() < REFRESH_WINDOW_MS;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow login page and all auth API routes through without checking
  if (pathname === '/login' || pathname === '/tenant/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Global admin API rate limit - checked before any auth or business logic
  const rateLimitResponse = await checkAdminApiRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isTenantPath = pathname.startsWith('/tenant') && pathname !== '/tenant/login';

  if (isAdminPath || isTenantPath) {
    const session = await getSessionFromRequest(request);

    if (!session?.userId) {
      // Not logged in or session revoked - go to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Support session auto-exit: if navigating to /admin/platform while holding a
    // scoped TENANT_ADMIN session (impersonatedBy is set), automatically restore the
    // original PLATFORM_ADMIN session from the backup cookie before serving the page.
    // SECURITY: validate the backup JWT against the DB before reinstating it.
    // Signature-only validation is insufficient — a revoked admin backup must NOT
    // be restorable via this path.
    let clearBackupCookie = false; // set when backup is stale; applied to final response
    if (session.impersonatedBy && pathname.startsWith('/admin/platform')) {
      const backupJwt = request.cookies.get('dream-admin-session')?.value;
      if (backupJwt) {
        // DB-backed check: rejects revoked/expired admin backup sessions
        const backupSession = await verifySessionWithDB(backupJwt).catch(() => null);
        if (!backupSession) {
          // Backup is revoked, expired, or invalid — mark the cookie for deletion
          // but DO NOT early-return.  Fall through so the remaining RBAC guards
          // (role check, /admin/platform access) still evaluate the current session.
          clearBackupCookie = true;
        } else {
          const isProduction = process.env.NODE_ENV === 'production';
          const response = NextResponse.redirect(new URL('/admin/platform', request.url));
          response.cookies.set('session', backupJwt, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24,
          });
          response.cookies.delete('dream-admin-session');
          return response;
        }
      }
    }

    // Role-based access control
    // /admin/platform and /api/admin/platform/* are PLATFORM_ADMIN-only.
    // Tenant-scoped and impersonation sessions must never reach either namespace,
    // including when backup restore has failed and the request falls back to the
    // scoped tenant session.
    const isPlatformNamespace =
      pathname.startsWith('/admin/platform') ||
      pathname.startsWith('/api/admin/platform');
    if (isPlatformNamespace && session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAdminPath && session.role !== 'PLATFORM_ADMIN' && !TENANT_ROLES.includes(session.role)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isTenantPath && !TENANT_ROLES.includes(session.role)) {
      // Platform admin trying to access /tenant/* - redirect them to /admin
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    if (isTenantPath && TENANT_ROLES.includes(session.role) && !session.organizationId) {
      // Tenant user with no org - back to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // MFA enforcement gate: when MFA_REQUIRED=true, privileged sessions that were
    // established before the flag was turned on (and therefore lack mfaVerified:true)
    // are rejected immediately — they cannot coast on the 24h JWT lifetime.
    if (
      process.env.MFA_REQUIRED === 'true' &&
      (session.role === 'PLATFORM_ADMIN' || session.role === 'TENANT_ADMIN') &&
      !session.mfaVerified
    ) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'MFA verification required. Please log in again.' },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Sliding-window token refresh: if the JWT is close to expiry, reissue it.
    // IMPORTANT: preserve all revocation-critical fields so that revoking a parent
    // PLATFORM_ADMIN session still invalidates an impersonation token after refresh.
    const response = NextResponse.next();
    if (clearBackupCookie) {
      response.cookies.delete('dream-admin-session');
    }
    if (shouldRefreshToken(request)) {
      try {
        const freshJwt = await createSessionToken({
          sessionId: session.sessionId,
          userId: session.userId,
          email: session.email,
          role: session.role,
          organizationId: session.organizationId,
          createdAt: session.createdAt,
          // Preserve impersonation linkage — without these the parent-session
          // revocation chain is broken on the first middleware-driven refresh.
          ...(session.impersonatedBy !== undefined && { impersonatedBy: session.impersonatedBy }),
          ...(session.parentSessionId !== undefined && { parentSessionId: session.parentSessionId }),
          // Preserve MFA verification status — dropping it would force re-login
          // on the next middleware refresh when MFA enforcement is active.
          ...(session.mfaVerified !== undefined && { mfaVerified: session.mfaVerified }),
        });
        response.cookies.set('session', freshJwt, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 24 hours
          path: '/',
        });
      } catch {
        // If refresh fails, continue with the existing token
      }
    }
    return response;
  }

  // ── Executive portal guard ──────────────────────────────────────────────────
  // /executive (root) is the login page — allow through without auth check.
  // Everything under /executive/* and /api/executive/* (except /api/executive/login) is protected.
  const isExecProtected = pathname.startsWith('/executive/') && pathname !== '/executive';
  const isExecApi = pathname.startsWith('/api/executive/') && pathname !== '/api/executive/login';

  if (isExecProtected || isExecApi) {
    const execCookie = request.cookies.get('exec-session');
    let execSession = null;
    if (execCookie?.value) {
      try {
        execSession = await verifyExecSessionWithDB(execCookie.value);
      } catch {
        execSession = null;
      }
    }
    if (!execSession) {
      if (isExecApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/executive', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/tenant/:path*', '/login', '/executive/:path*', '/api/executive/:path*'],
};
