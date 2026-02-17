import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';

const TENANT_ROLES = ['TENANT_ADMIN', 'TENANT_USER'];

async function getSessionFromRequest(request: NextRequest) {
  const cookie = request.cookies.get('session');
  if (!cookie?.value) return null;
  try {
    return await verifySessionToken(cookie.value);
  } catch {
    return null;
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

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/tenant/:path*', '/login'],
};
