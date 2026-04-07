/**
 * Integration Tests — PLATFORM_ADMIN Login Route
 *
 * Proves that the actual POST /api/auth/login handler:
 *   1. Creates a DB Session row before issuing a JWT to PLATFORM_ADMIN
 *   2. Fails closed (500, no cookie) if DB session persistence fails
 *   3. Does not fall back to signature-only auth on DB write failure
 *
 * These tests import and execute the real route handler so any regression
 * (e.g. re-adding a swallowed catch) will cause them to fail.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';

// ── Mocks ────────────────────────────────────────────────────────────────────

// vi.hoisted ensures mockCookieSet is initialised before vi.mock factories run.
const { mockCookieSet } = vi.hoisted(() => ({
  mockCookieSet: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: mockCookieSet,
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  createSessionToken: vi.fn().mockResolvedValue('mock-platform-admin-jwt'),
  verifySessionToken: vi.fn(),
  verifySessionWithDB: vi.fn(),
  getSession: vi.fn(),
  refreshSessionToken: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  authLimiter: {
    check: vi.fn().mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 }),
  },
  apiLimiter: {
    check: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  },
  strictLimiter: {
    check: vi.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 }),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'mock-session-id',
}));

// bcrypt mock — ADMIN_PASSWORD must start with '$2' for the route to call bcrypt.compare
vi.mock('bcryptjs', () => ({
  compare: vi.fn().mockResolvedValue(true),
}));

// ── Import handler after mocks ────────────────────────────────────────────────

import { POST } from '@/app/api/auth/login/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAdminLoginRequest(): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.com', password: 'plaintext' }),
    headers: { 'Content-Type': 'application/json', 'user-agent': 'test-agent' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PLATFORM_ADMIN login — DB session persistence', () => {
  beforeEach(() => {
    resetMockPrisma();
    mockCookieSet.mockClear();

    // Set env vars for PLATFORM_ADMIN branch
    process.env.ADMIN_USERNAME = 'admin@example.com';
    // Must start with '$2' so the route calls bcrypt.compare (not plaintext reject)
    process.env.ADMIN_PASSWORD = '$2b$10$mockhash';
    process.env.SESSION_SECRET = 'test-secret-that-is-32-chars-long!!';
  });

  it('creates a DB Session row before issuing the JWT on successful login', async () => {
    // Arrange: DB write succeeds
    mockPrisma.session.create.mockResolvedValue({
      id: 'mock-session-id',
      userId: null,
      token: 'mock-platform-admin-jwt',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      createdAt: new Date(),
    });

    // Act
    const response = await POST(makeAdminLoginRequest());
    const body = await response.json();

    // Assert: DB session was created
    expect(mockPrisma.session.create).toHaveBeenCalledOnce();
    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'mock-session-id',
          userId: null,
          token: 'mock-platform-admin-jwt',
        }),
      }),
    );

    // Assert: login succeeded only after DB write
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('PLATFORM_ADMIN');
  });

  it('fails closed (500) when DB session persistence fails — no cookie issued', async () => {
    // Arrange: DB write fails (e.g. migration not applied, connection lost)
    mockPrisma.session.create.mockRejectedValue(new Error('DB connection failed'));

    // Act
    const response = await POST(makeAdminLoginRequest());
    const body = await response.json();

    // Assert: login is refused
    expect(response.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(body.success).toBeUndefined();

    // Assert: no session cookie was set — client cannot authenticate
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('does not fall back to signature-only auth when DB write fails', async () => {
    // This test proves the critical invariant: DB failure = no login.
    // If the catch block were swallowed, success:true would be returned despite DB failure.
    mockPrisma.session.create.mockRejectedValue(new Error('DB write failed'));

    const response = await POST(makeAdminLoginRequest());
    const body = await response.json();

    // The response must NOT be a success response
    expect(body).not.toMatchObject({ success: true });
    // And session.create was attempted (it's not being skipped)
    expect(mockPrisma.session.create).toHaveBeenCalledOnce();
  });
});
