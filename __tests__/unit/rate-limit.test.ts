/**
 * Unit Tests - Production-Grade Distributed Rate Limiting (Remediation #8)
 *
 * Tests that:
 *   1. In-memory fallback: allow/deny/reset/independent tokens
 *   2. Distributed mode: delegates to Upstash when env vars are set
 *   3. Fallback on Upstash failure: gracefully degrades to in-memory
 *   4. Pre-configured limiters exist with correct interface
 *   5. _resetForTesting clears all state
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Upstash modules (vi.hoisted ensures fns exist before vi.mock hoisting)
// ---------------------------------------------------------------------------

const { mockUpstashLimit, mockSlidingWindow } = vi.hoisted(() => ({
  mockUpstashLimit: vi.fn(),
  mockSlidingWindow: vi.fn().mockReturnValue('mock-sliding-window-config'),
}));

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({ _mock: true })),
}));

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = mockUpstashLimit;
    static slidingWindow = mockSlidingWindow;
  }
  return { Ratelimit: MockRatelimit };
});

// ---------------------------------------------------------------------------
// Import module under test (after mocks are set up)
// ---------------------------------------------------------------------------

import {
  rateLimit,
  apiLimiter,
  authLimiter,
  strictLimiter,
  _resetForTesting,
} from '@/lib/rate-limit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearUpstashEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

function setUpstashEnv() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Rate Limiter (Remediation #8)', () => {
  beforeEach(() => {
    _resetForTesting();
    mockUpstashLimit.mockReset();
    clearUpstashEnv();
  });

  afterEach(() => {
    clearUpstashEnv();
  });

  // -----------------------------------------------------------------------
  // In-memory fallback (no Upstash env vars)
  // -----------------------------------------------------------------------

  describe('in-memory fallback (no Upstash env vars)', () => {
    it('allows requests within limit', async () => {
      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });

      const r1 = await limiter.check(3, 'user-1');
      expect(r1.success).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = await limiter.check(3, 'user-1');
      expect(r2.success).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = await limiter.check(3, 'user-1');
      expect(r3.success).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it('denies requests exceeding limit', async () => {
      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });

      await limiter.check(2, 'user-2');
      await limiter.check(2, 'user-2');

      const denied = await limiter.check(2, 'user-2');
      expect(denied.success).toBe(false);
      expect(denied.remaining).toBe(0);
    });

    it('includes a reset timestamp in the future', async () => {
      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
      const before = Date.now();

      const result = await limiter.check(5, 'user-ts');

      expect(result.reset).toBeGreaterThan(before);
      expect(result.reset).toBeLessThanOrEqual(before + 60_000 + 50); // small tolerance
    });

    it('resets after interval expires', async () => {
      const limiter = rateLimit({ interval: 100, uniqueTokenPerInterval: 100 });

      await limiter.check(1, 'user-3');
      const denied = await limiter.check(1, 'user-3');
      expect(denied.success).toBe(false);

      // Wait for interval to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const allowed = await limiter.check(1, 'user-3');
      expect(allowed.success).toBe(true);
      expect(allowed.remaining).toBe(0);
    });

    it('tracks different tokens independently', async () => {
      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });

      // Exhaust limit for user-a
      await limiter.check(1, 'user-a');
      const denied = await limiter.check(1, 'user-a');
      expect(denied.success).toBe(false);

      // user-b is still allowed
      const allowed = await limiter.check(1, 'user-b');
      expect(allowed.success).toBe(true);
    });

    it('does not call Upstash when env vars are absent', async () => {
      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
      await limiter.check(5, 'user-no-upstash');

      expect(mockUpstashLimit).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Distributed mode (Upstash env vars set)
  // -----------------------------------------------------------------------

  describe('distributed mode (Upstash env vars set)', () => {
    beforeEach(() => {
      setUpstashEnv();
      _resetForTesting();
    });

    it('delegates to Upstash Ratelimit.limit() when env vars are set', async () => {
      const resetTs = Date.now() + 60_000;
      mockUpstashLimit.mockResolvedValue({
        success: true,
        remaining: 4,
        limit: 5,
        reset: resetTs,
      });

      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
      const result = await limiter.check(5, 'dist-user-1');

      expect(mockUpstashLimit).toHaveBeenCalledWith('dist-user-1');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.reset).toBe(resetTs);
    });

    it('returns deny result from Upstash', async () => {
      const resetTs = Date.now() + 60_000;
      mockUpstashLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        limit: 5,
        reset: resetTs,
      });

      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
      const result = await limiter.check(5, 'dist-user-2');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('caches Upstash instances: two calls share one limit mock', async () => {
      mockUpstashLimit.mockResolvedValue({
        success: true,
        remaining: 9,
        limit: 10,
        reset: Date.now() + 60_000,
      });

      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });

      // Two calls with same limit should reuse the cached Upstash instance
      await limiter.check(10, 'cache-test-a');
      await limiter.check(10, 'cache-test-b');

      // Both calls reached Upstash (same cached instance)
      expect(mockUpstashLimit).toHaveBeenCalledTimes(2);
      expect(mockUpstashLimit).toHaveBeenCalledWith('cache-test-a');
      expect(mockUpstashLimit).toHaveBeenCalledWith('cache-test-b');
    });
  });

  // -----------------------------------------------------------------------
  // Fallback on Upstash failure
  // -----------------------------------------------------------------------

  describe('fallback on Upstash failure', () => {
    beforeEach(() => {
      setUpstashEnv();
      _resetForTesting();
    });

    it('falls back to in-memory when Upstash throws', async () => {
      mockUpstashLimit.mockRejectedValue(new Error('Redis connection refused'));

      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
      const result = await limiter.check(5, 'fallback-user');

      // Should succeed via in-memory fallback (not throw)
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('in-memory fallback still enforces limits when Upstash is down', async () => {
      mockUpstashLimit.mockRejectedValue(new Error('Redis timeout'));

      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });

      await limiter.check(1, 'fallback-deny');
      const denied = await limiter.check(1, 'fallback-deny');

      expect(denied.success).toBe(false);
      expect(denied.remaining).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Pre-configured limiters
  // -----------------------------------------------------------------------

  describe('pre-configured limiters', () => {
    it('apiLimiter exists and has check method', () => {
      expect(apiLimiter).toBeDefined();
      expect(typeof apiLimiter.check).toBe('function');
    });

    it('authLimiter exists and has check method', () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter.check).toBe('function');
    });

    it('strictLimiter exists and has check method', () => {
      expect(strictLimiter).toBeDefined();
      expect(typeof strictLimiter.check).toBe('function');
    });

    it('apiLimiter works in-memory mode', async () => {
      const r = await apiLimiter.check(60, 'api-test-ip');
      expect(r.success).toBe(true);
      expect(r.remaining).toBe(59);
    });
  });

  // -----------------------------------------------------------------------
  // _resetForTesting
  // -----------------------------------------------------------------------

  describe('_resetForTesting', () => {
    it('clears in-memory state so limits restart', async () => {
      const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });

      // Exhaust the limit
      await limiter.check(1, 'reset-user');
      const denied = await limiter.check(1, 'reset-user');
      expect(denied.success).toBe(false);

      // Reset
      _resetForTesting();

      // Same token should be allowed again
      const allowed = await limiter.check(1, 'reset-user');
      expect(allowed.success).toBe(true);
    });
  });
});
