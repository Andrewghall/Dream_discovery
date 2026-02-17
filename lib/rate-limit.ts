// Simple in-memory rate limiter for Next.js
// No Redis required - good for development and small-scale production

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max requests per interval
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const limiters = new Map<string, Map<string, RateLimitRecord>>();

export function rateLimit(config: RateLimitConfig) {
  const { interval, uniqueTokenPerInterval } = config;

  return {
    check: async (limit: number, token: string): Promise<{ success: boolean; remaining: number; reset: number }> => {
      const limiterKey = `${interval}-${uniqueTokenPerInterval}`;

      if (!limiters.has(limiterKey)) {
        limiters.set(limiterKey, new Map());
      }

      const tokenLimits = limiters.get(limiterKey)!;
      const now = Date.now();

      const record = tokenLimits.get(token);

      if (!record || now > record.resetTime) {
        // Create new record or reset expired one
        const newRecord: RateLimitRecord = {
          count: 1,
          resetTime: now + interval,
        };
        tokenLimits.set(token, newRecord);

        return {
          success: true,
          remaining: limit - 1,
          reset: newRecord.resetTime,
        };
      }

      // Increment existing record
      record.count++;

      if (record.count > limit) {
        return {
          success: false,
          remaining: 0,
          reset: record.resetTime,
        };
      }

      tokenLimits.set(token, record);

      return {
        success: true,
        remaining: limit - record.count,
        reset: record.resetTime,
      };
    },
  };
}

// Cleanup old records every hour
setInterval(() => {
  const now = Date.now();
  limiters.forEach((tokenLimits) => {
    tokenLimits.forEach((record, token) => {
      if (now > record.resetTime) {
        tokenLimits.delete(token);
      }
    });
  });
}, 60 * 60 * 1000); // 1 hour

// Pre-configured rate limiters
export const apiLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 unique IPs per interval
});

export const authLimiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 500,
});

export const strictLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
});
