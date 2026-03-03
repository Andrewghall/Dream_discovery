/**
 * Production-grade rate limiter with distributed backend support
 *
 * Backend selection (checked per-call, not at module load):
 *   - If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set:
 *     uses @upstash/ratelimit with a sliding window (distributed, multi-instance safe)
 *   - Otherwise: falls back to in-memory limiter (suitable for dev / single-instance)
 *
 * If Upstash is configured but a call fails at runtime the limiter falls back
 * to in-memory for that request so routes stay available while still being
 * rate-limited.
 *
 * Required env vars for distributed mode:
 *   UPSTASH_REDIS_REST_URL   - Upstash Redis REST endpoint
 *   UPSTASH_REDIS_REST_TOKEN - Upstash Redis REST auth token
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// ---------------------------------------------------------------------------
// Public interface (unchanged from prior version)
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max unique keys tracked (in-memory path only)
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // Timestamp (ms) when the current window resets
}

// ---------------------------------------------------------------------------
// Backend detection (evaluated per-call so tests can toggle env vars)
// ---------------------------------------------------------------------------

function isDistributed(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}

// ---------------------------------------------------------------------------
// Distributed backend (Upstash Redis sliding window)
// ---------------------------------------------------------------------------

let _redis: InstanceType<typeof Redis> | null = null;
const _upstashCache = new Map<string, InstanceType<typeof Ratelimit>>();

function getRedis(): InstanceType<typeof Redis> {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

function getUpstashLimiter(intervalMs: number, limit: number): InstanceType<typeof Ratelimit> {
  const cacheKey = `${intervalMs}:${limit}`;
  let inst = _upstashCache.get(cacheKey);
  if (!inst) {
    const windowSec = Math.max(1, Math.ceil(intervalMs / 1000));
    inst = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `rl:${cacheKey}`,
    });
    _upstashCache.set(cacheKey, inst);
  }
  return inst;
}

async function checkDistributed(
  intervalMs: number,
  limit: number,
  token: string,
): Promise<RateLimitResult> {
  const rl = getUpstashLimiter(intervalMs, limit);
  const res = await rl.limit(token);
  return { success: res.success, remaining: res.remaining, reset: res.reset };
}

// ---------------------------------------------------------------------------
// In-memory backend (dev / single-instance / Upstash-down fallback)
// ---------------------------------------------------------------------------

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const _inMemoryLimiters = new Map<string, Map<string, RateLimitRecord>>();

function checkInMemory(
  limiterKey: string,
  interval: number,
  limit: number,
  token: string,
): RateLimitResult {
  if (!_inMemoryLimiters.has(limiterKey)) {
    _inMemoryLimiters.set(limiterKey, new Map());
  }

  const tokenLimits = _inMemoryLimiters.get(limiterKey)!;
  const now = Date.now();
  const record = tokenLimits.get(token);

  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = { count: 1, resetTime: now + interval };
    tokenLimits.set(token, newRecord);
    return { success: true, remaining: limit - 1, reset: newRecord.resetTime };
  }

  record.count++;

  if (record.count > limit) {
    return { success: false, remaining: 0, reset: record.resetTime };
  }

  tokenLimits.set(token, record);
  return { success: true, remaining: limit - record.count, reset: record.resetTime };
}

// ---------------------------------------------------------------------------
// Public factory (preserves existing interface for all call sites)
// ---------------------------------------------------------------------------

export function rateLimit(config: RateLimitConfig) {
  const { interval, uniqueTokenPerInterval } = config;
  const memKey = `${interval}-${uniqueTokenPerInterval}`;

  return {
    check: async (limit: number, token: string): Promise<RateLimitResult> => {
      if (isDistributed()) {
        try {
          return await checkDistributed(interval, limit, token);
        } catch (err) {
          console.error('Upstash rate limit failed, falling back to in-memory:', err);
        }
      }
      return checkInMemory(memKey, interval, limit, token);
    },
  };
}

// ---------------------------------------------------------------------------
// Cleanup expired in-memory records every hour
// ---------------------------------------------------------------------------

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    _inMemoryLimiters.forEach((tokenLimits) => {
      tokenLimits.forEach((record, token) => {
        if (now > record.resetTime) {
          tokenLimits.delete(token);
        }
      });
    });
  }, 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Pre-configured rate limiters
// ---------------------------------------------------------------------------

export const apiLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export const authLimiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 500,
});

export const strictLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
});

// ---------------------------------------------------------------------------
// Test helper (resets all internal state; not for production use)
// ---------------------------------------------------------------------------

export function _resetForTesting(): void {
  _redis = null;
  _upstashCache.clear();
  _inMemoryLimiters.clear();
}
