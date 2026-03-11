/**
 * Simple in-process circuit breaker.
 *
 * States:
 *  CLOSED   — normal operation; failures are counted within a rolling window.
 *  OPEN     — downstream is considered down; calls fail immediately.
 *  HALF_OPEN — one probe call allowed; success closes, failure reopens.
 *
 * One instance per downstream service, created once at module load and
 * reused across requests in the same serverless isolate.
 */

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface BreakerConfig {
  /** Number of failures within `windowMs` before opening. Default 5. */
  failureThreshold: number;
  /** Rolling window for failure counting (ms). Default 60_000. */
  windowMs: number;
  /** How long to stay OPEN before allowing a probe (ms). Default 30_000. */
  resetTimeoutMs: number;
}

const DEFAULT_CONFIG: BreakerConfig = {
  failureThreshold: 5,
  windowMs: 60_000,
  resetTimeoutMs: 30_000,
};

export class CircuitBreaker {
  private state: BreakerState = 'CLOSED';
  private failures = 0;
  private lastFailureAt = 0;
  private nextProbeAt = 0;

  constructor(
    readonly name: string,
    private config: BreakerConfig = DEFAULT_CONFIG,
  ) {}

  /** Execute `fn` through the breaker. Throws if the circuit is OPEN. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextProbeAt) {
        throw new Error(`[CircuitBreaker:${this.name}] Circuit open — service unavailable`);
      }
      // Time for a probe attempt
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  getState(): BreakerState {
    return this.state;
  }

  /** Force-reset (useful in tests). */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureAt = 0;
    this.nextProbeAt = 0;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    const now = Date.now();
    // Reset failure count if outside the rolling window
    if (now - this.lastFailureAt > this.config.windowMs) {
      this.failures = 0;
    }
    this.failures++;
    this.lastFailureAt = now;

    if (this.failures >= this.config.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextProbeAt = now + this.config.resetTimeoutMs;
      console.error(
        `[CircuitBreaker:${this.name}] Opened after ${this.failures} failures — probing at ${new Date(this.nextProbeAt).toISOString()}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-configured breakers (one per downstream service)
// ---------------------------------------------------------------------------

/** Wraps all CaptureAPI transcription calls. 3 failures → 30s backoff. */
export const captureApiBreaker = new CircuitBreaker('captureapi', {
  failureThreshold: 3,
  windowMs: 60_000,
  resetTimeoutMs: 30_000,
});

/** Wraps all OpenAI completion calls. 5 failures → 60s backoff. */
export const openAiBreaker = new CircuitBreaker('openai', {
  failureThreshold: 5,
  windowMs: 60_000,
  resetTimeoutMs: 60_000,
});
