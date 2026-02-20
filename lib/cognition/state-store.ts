/**
 * Cognitive State Store — globalThis-backed in-memory persistence
 *
 * Same pattern as workshop-events.ts SSE store. Each workshop session
 * gets its own CognitiveState that persists across requests while the
 * serverless function stays warm.
 *
 * On Vercel, a single live session routes to the same isolate during
 * active streaming, so this works for real-time capture.
 */

import { CognitiveState, createCognitiveState } from './cognitive-state';

// ── Store Shape ─────────────────────────────────────────────
type CognitiveStore = {
  stateByWorkshop: Map<string, CognitiveState>;
};

// ── Singleton Access ────────────────────────────────────────
function getStore(): CognitiveStore {
  const g = globalThis as typeof globalThis & { __dreamCognitiveStore?: CognitiveStore };
  if (!g.__dreamCognitiveStore) {
    g.__dreamCognitiveStore = {
      stateByWorkshop: new Map(),
    };
  }
  return g.__dreamCognitiveStore;
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

/**
 * Get the cognitive state for a workshop. Returns null if none exists.
 */
export function getCognitiveState(workshopId: string): CognitiveState | null {
  return getStore().stateByWorkshop.get(workshopId) ?? null;
}

/**
 * Get or create the cognitive state for a workshop.
 * If one already exists, returns it. Otherwise creates a fresh one.
 */
export function getOrCreateCognitiveState(
  workshopId: string,
  workshopGoal: string,
  currentPhase: CognitiveState['currentPhase'] = 'REIMAGINE'
): CognitiveState {
  const store = getStore();
  const existing = store.stateByWorkshop.get(workshopId);
  if (existing) {
    // Update phase if it changed
    existing.currentPhase = currentPhase;
    return existing;
  }

  const state = createCognitiveState(workshopId, workshopGoal, currentPhase);
  store.stateByWorkshop.set(workshopId, state);
  return state;
}

/**
 * Replace the cognitive state for a workshop (e.g. from snapshot restore).
 */
export function setCognitiveState(workshopId: string, state: CognitiveState): void {
  getStore().stateByWorkshop.set(workshopId, state);
}

/**
 * Remove the cognitive state for a workshop (cleanup).
 */
export function removeCognitiveState(workshopId: string): void {
  getStore().stateByWorkshop.delete(workshopId);
}

/**
 * List all active workshop IDs with cognitive state.
 */
export function listActiveSessions(): string[] {
  return Array.from(getStore().stateByWorkshop.keys());
}

// ── Periodic Cleanup ────────────────────────────────────────
// Remove stale sessions (no activity for 2 hours)
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const store = getStore();
    for (const [id, state] of store.stateByWorkshop.entries()) {
      if (now - state.lastActivityMs > STALE_THRESHOLD_MS) {
        store.stateByWorkshop.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}
