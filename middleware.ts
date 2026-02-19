import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, createSessionToken } from '@/lib/auth/session';
import * as jose from 'jose';

const TENANT_ROLES = ['TENANT_ADMIN', 'TENANT_USER'];
const REFRESH_WINDOW_MS = 2 * 60 * 60 * 1000; // Refresh if within 2 hours of expiry

async function getSessionFromRequest(request: NextRequest) {
  const cookie = request.cookies.get('session');
  if (!cookie?.value) return null;
  try {
    return await verifySessionToken(cookie.value);
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
    const expiresAt = decoded.exp * 1000; // seconds → ms
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

  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isTenantPath = pathname.startsWith('/tenant') && pathname !== '/tenant/login';

  if (isAdminPath || isTenantPath) {
    const session = await getSessionFromRequest(request);

    if (!session?.userId) {
      // Not logged in — go to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based access control
    if (isAdminPath && session.role !== 'PLATFORM_ADMIN' && !TENANT_ROLES.includes(session.role)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isTenantPath && !TENANT_ROLES.includes(session.role)) {
      // Platform admin trying to access /tenant/* — redirect them to /admin
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    if (isTenantPath && TENANT_ROLES.includes(session.role) && !session.organizationId) {
      // Tenant user with no org — back to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Sliding-window token refresh: if the JWT is close to expiry, reissue it
    const response = NextResponse.next();
    if (shouldRefreshToken(request)) {
      try {
        const freshJwt = await createSessionToken({
          sessionId: session.sessionId,
          userId: session.userId,
          email: session.email,
          role: session.role,
          organizationId: session.organizationId,
          createdAt: session.createdAt,
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/tenant/:path*', '/login'],
};
