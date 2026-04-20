/**
 * Debug trace outcome classification tests.
 *
 * Verifies that ThoughtWindow states are mapped to the correct TraceOutcome:
 *  - OPEN / PAUSED / RESOLVING → 'in_flight'   (not a failure)
 *  - EXPIRED                   → 'blocked_at_commit'
 *  - RESOLVED + no DataPoints  → 'rejected_in_extraction'
 *  - RESOLVED + DataPoints, no emit → 'persisted_not_emitted'
 *  - RESOLVED + DataPoints + emit   → 'rendered'
 */

import { describe, it, expect } from 'vitest';
import type { TraceOutcome, CommitStatus } from '@/lib/debug/trace-types';

// Pure classification logic extracted from the route for unit testing.
// Keep in sync with app/api/admin/workshops/[id]/debug/trace/route.ts.
function classifyCommitStatus(state: string): CommitStatus {
  const isResolved = state === 'RESOLVED';
  const isInFlight = state === 'OPEN' || state === 'PAUSED' || state === 'RESOLVING';
  if (isInFlight)   return 'pending';
  if (isResolved)   return 'pass';
  return 'blocked';
}

function classifyOutcome(
  state: string,
  hasDataPoints: boolean,
  emitted: boolean,
): TraceOutcome {
  const isResolved  = state === 'RESOLVED';
  const isExpired   = state === 'EXPIRED';
  const isInFlight  = state === 'OPEN' || state === 'PAUSED' || state === 'RESOLVING';
  const commitPass  = isResolved;

  if (isInFlight)           return 'in_flight';
  if (!commitPass)          return 'blocked_at_commit';  // EXPIRED only
  if (!hasDataPoints)       return 'rejected_in_extraction';
  if (!emitted)             return 'persisted_not_emitted';
  return 'rendered';
}

describe('classifyCommitStatus', () => {
  it('OPEN → pending', () => expect(classifyCommitStatus('OPEN')).toBe('pending'));
  it('PAUSED → pending', () => expect(classifyCommitStatus('PAUSED')).toBe('pending'));
  it('RESOLVING → pending', () => expect(classifyCommitStatus('RESOLVING')).toBe('pending'));
  it('RESOLVED → pass', () => expect(classifyCommitStatus('RESOLVED')).toBe('pass'));
  it('EXPIRED → blocked', () => expect(classifyCommitStatus('EXPIRED')).toBe('blocked'));

  it('commitPass is true only for pass', () => {
    expect(classifyCommitStatus('RESOLVED') === 'pass').toBe(true);
    expect(classifyCommitStatus('OPEN') === 'pass').toBe(false);
    expect(classifyCommitStatus('EXPIRED') === 'pass').toBe(false);
  });
});

describe('classifyOutcome', () => {
  it('OPEN → in_flight', () => {
    expect(classifyOutcome('OPEN', false, false)).toBe('in_flight');
  });

  it('PAUSED → in_flight', () => {
    expect(classifyOutcome('PAUSED', false, false)).toBe('in_flight');
  });

  it('RESOLVING → in_flight', () => {
    expect(classifyOutcome('RESOLVING', false, false)).toBe('in_flight');
  });

  it('EXPIRED → blocked_at_commit', () => {
    expect(classifyOutcome('EXPIRED', false, false)).toBe('blocked_at_commit');
  });

  it('RESOLVED, no DataPoints → rejected_in_extraction', () => {
    expect(classifyOutcome('RESOLVED', false, false)).toBe('rejected_in_extraction');
  });

  it('RESOLVED, DataPoints, not emitted → persisted_not_emitted', () => {
    expect(classifyOutcome('RESOLVED', true, false)).toBe('persisted_not_emitted');
  });

  it('RESOLVED, DataPoints, emitted → rendered', () => {
    expect(classifyOutcome('RESOLVED', true, true)).toBe('rendered');
  });

  it('in_flight window with DataPoints still reports in_flight', () => {
    // An OPEN window that somehow already has DataPoints should still be in_flight
    expect(classifyOutcome('OPEN', true, false)).toBe('in_flight');
  });
});

describe('aggregate counters', () => {
  it('totalBlocked excludes in-flight windows', () => {
    const outcomes: TraceOutcome[] = [
      'rendered',
      'in_flight',
      'in_flight',
      'blocked_at_commit',
      'rejected_in_extraction',
    ];
    const totalBlocked  = outcomes.filter((o) => o === 'blocked_at_commit').length;
    const totalInFlight = outcomes.filter((o) => o === 'in_flight').length;
    expect(totalBlocked).toBe(1);
    expect(totalInFlight).toBe(2);
  });

  it('missing filter excludes in-flight windows', () => {
    const outcomes: TraceOutcome[] = ['rendered', 'in_flight', 'blocked_at_commit'];
    // "missing" = not rendered AND not in_flight
    const missing = outcomes.filter((o) => o !== 'rendered' && o !== 'in_flight');
    expect(missing).toEqual(['blocked_at_commit']);
  });
});
