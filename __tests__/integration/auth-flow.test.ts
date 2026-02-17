/**
 * Integration Tests - Authentication Flow
 * Tests for login, logout, session validation, and account lockout
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { mockPrisma, resetMockPrisma } from '../utils/mock-prisma';
import { createMockRequest, getResponseJSON, getResponseStatus } from '../utils/test-helpers';
import { mockUser, mockSession } from '../utils/test-fixtures';
import * as bcrypt from 'bcryptjs';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';
import { verifySessionToken } from '@/lib/auth/session';

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

// Mock session functions
vi.mock('@/lib/auth/session', () => ({
  createSessionToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  verifySessionToken: vi.fn(),
}));

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    resetMockPrisma();
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'correctPassword123';

      // Mock successful password comparison
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Mock user lookup
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock session creation
      const mockSessionRecord = {
        ...mockSession,
        token: 'mock-jwt-token',
      };
      mockPrisma.session.create.mockResolvedValue(mockSessionRecord);

      // Mock user update (last login)
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: { email, password },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await loginPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
      });

      // Verify session was created
      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          token: 'mock-jwt-token',
          ipAddress: '127.0.0.1',
        }),
      });

      // Verify failed login count was reset
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            failedLoginCount: 0,
            lockedUntil: null,
          }),
        })
      );
    });

    it('should reject login with invalid password', async () => {
      const email = 'test@example.com';
      const password = 'wrongPassword';

      // Mock failed password comparison
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Mock user lookup
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock failed login count increment
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        failedLoginCount: 1,
      });

      // Mock login attempt logging
      mockPrisma.loginAttempt.create.mockResolvedValue({
        id: 'attempt-id',
        email,
        success: false,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        failureReason: 'Invalid credentials',
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: { email, password },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await loginPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(401);
      expect(data.error).toBe('Invalid credentials');

      // Verify failed login count was incremented
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            failedLoginCount: expect.any(Number),
          }),
        })
      );

      // Verify login attempt was logged
      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email,
          success: false,
          ipAddress: '127.0.0.1',
        }),
      });
    });

    it('should reject login for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'anyPassword';

      // Mock user not found
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Mock login attempt logging
      mockPrisma.loginAttempt.create.mockResolvedValue({
        id: 'attempt-id',
        email,
        success: false,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        failureReason: 'User not found',
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: { email, password },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await loginPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(401);
      expect(data.error).toBe('Invalid credentials');

      // Verify login attempt was logged
      expect(mockPrisma.loginAttempt.create).toHaveBeenCalled();
    });

    it('should lock account after 5 failed login attempts', async () => {
      const email = 'test@example.com';
      const password = 'wrongPassword';

      // Mock user with 4 failed attempts
      const lockedUser = {
        ...mockUser,
        failedLoginCount: 4,
      };

      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      mockPrisma.user.findUnique.mockResolvedValue(lockedUser);

      // Mock user update to locked state
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      mockPrisma.user.update.mockResolvedValue({
        ...lockedUser,
        failedLoginCount: 5,
        lockedUntil,
      });

      mockPrisma.loginAttempt.create.mockResolvedValue({
        id: 'attempt-id',
        email,
        success: false,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        failureReason: 'Account locked',
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: { email, password },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await loginPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(401);
      expect(data.error).toContain('locked');

      // Verify account was locked
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: lockedUser.id },
          data: expect.objectContaining({
            failedLoginCount: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      );
    });

    it('should reject login for locked account', async () => {
      const email = 'test@example.com';
      const password = 'anyPassword';

      // Mock locked user
      const lockedUser = {
        ...mockUser,
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // Locked for 10 more minutes
      };

      mockPrisma.user.findUnique.mockResolvedValue(lockedUser);

      mockPrisma.loginAttempt.create.mockResolvedValue({
        id: 'attempt-id',
        email,
        success: false,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        failureReason: 'Account locked',
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: { email, password },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await loginPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(403);
      expect(data.error).toContain('locked');

      // Should not check password for locked accounts
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should allow login after lock period expires', async () => {
      const email = 'test@example.com';
      const password = 'correctPassword123';

      // Mock user with expired lock
      const unlockedUser = {
        ...mockUser,
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() - 1000), // Lock expired 1 second ago
      };

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockPrisma.user.findUnique.mockResolvedValue(unlockedUser);

      mockPrisma.session.create.mockResolvedValue({
        ...mockSession,
        token: 'mock-jwt-token',
      });

      mockPrisma.user.update.mockResolvedValue({
        ...unlockedUser,
        failedLoginCount: 0,
        lockedUntil: null,
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: { email, password },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await loginPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Verify lock was cleared
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: unlockedUser.id },
          data: expect.objectContaining({
            failedLoginCount: 0,
            lockedUntil: null,
          }),
        })
      );
    });

    it('should reject login with missing credentials', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: { email: 'test@example.com' }, // Missing password
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await loginPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should reject login with inactive user', async () => {
      const email = 'inactive@example.com';
      const password = 'anyPassword';

      // Mock inactive user
      const inactiveUser = {
        ...mockUser,
        isActive: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      mockPrisma.loginAttempt.create.mockResolvedValue({
        id: 'attempt-id',
        email,
        success: false,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        failureReason: 'Account inactive',
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: { email, password },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      const response = await loginPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(403);
      expect(data.error).toContain('inactive');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout with valid session', async () => {
      const sessionToken = 'valid-jwt-token';

      // Mock session lookup
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Mock session deletion
      mockPrisma.session.delete.mockResolvedValue(mockSession);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/logout',
        cookies: {
          session: sessionToken,
        },
      });

      const response = await logoutPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Verify session was deleted
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { token: sessionToken },
      });
    });

    it('should handle logout with no session cookie', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/logout',
        cookies: {},
      });

      const response = await logoutPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Should not attempt to delete session
      expect(mockPrisma.session.delete).not.toHaveBeenCalled();
    });

    it('should handle logout with invalid session', async () => {
      const sessionToken = 'invalid-jwt-token';

      // Mock session not found
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/logout',
        cookies: {
          session: sessionToken,
        },
      });

      const response = await logoutPOST(request as NextRequest);
      const status = getResponseStatus(response);
      const data = await getResponseJSON(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Should not attempt to delete non-existent session
      expect(mockPrisma.session.delete).not.toHaveBeenCalled();
    });
  });

  describe('Session Validation Middleware', () => {
    it('should validate valid JWT session token', async () => {
      const mockSessionPayload = {
        sessionId: 'test-session-id',
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'PLATFORM_ADMIN',
        organizationId: 'test-org-id',
        createdAt: Date.now(),
      };

      // Mock JWT verification
      vi.mocked(verifySessionToken).mockResolvedValue(mockSessionPayload);

      const sessionToken = 'valid-jwt-token';
      const result = await verifySessionToken(sessionToken);

      expect(result).toEqual(mockSessionPayload);
      expect(result?.userId).toBe('test-user-id');
      expect(result?.role).toBe('PLATFORM_ADMIN');
    });

    it('should reject expired JWT session token', async () => {
      // Mock JWT verification failure
      vi.mocked(verifySessionToken).mockResolvedValue(null);

      const expiredToken = 'expired-jwt-token';
      const result = await verifySessionToken(expiredToken);

      expect(result).toBeNull();
    });

    it('should reject malformed JWT session token', async () => {
      // Mock JWT verification failure
      vi.mocked(verifySessionToken).mockResolvedValue(null);

      const malformedToken = 'not-a-valid-jwt';
      const result = await verifySessionToken(malformedToken);

      expect(result).toBeNull();
    });
  });
});
