import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, authLimiter, strictLimiter } from './rate-limit';
import { prisma } from './prisma';
import { nanoid } from 'nanoid';

type RateLimitType = 'api' | 'auth' | 'strict';

export function withRateLimit(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  type: RateLimitType = 'api'
) {
  return async (request: NextRequest, ...args: any[]) => {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Select limiter based on type
    const limiter = type === 'auth' ? authLimiter : type === 'strict' ? strictLimiter : apiLimiter;

    // Set limit based on type
    const limit = type === 'auth' ? 5 : type === 'strict' ? 10 : 60; // requests per interval

    const result = await limiter.check(limit, ip);

    if (!result.success) {
      // Log rate limit violation
      await logRateLimitViolation(ip, request.url, type);

      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler(request, ...args);

    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());

    return response;
  };
}

async function logRateLimitViolation(ip: string, url: string, type: string) {
  try {
    // Use raw SQL since Prisma model doesn't exist yet
    await prisma.$executeRaw`
      INSERT INTO audit_logs (
        id, "organizationId", "userId", action, "resourceType", "resourceId",
        "ipAddress", "userAgent", metadata, success
      ) VALUES (
        ${nanoid()}, 'system', NULL, 'RATE_LIMIT_VIOLATION', 'API', ${url},
        ${ip}, 'rate-limiter', ${JSON.stringify({ type, url })}::jsonb, false
      )
    `;
  } catch (error) {
    console.error('Failed to log rate limit violation:', error);
  }
}
