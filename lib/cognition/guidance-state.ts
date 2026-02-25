/**
 * Guidance State Store — globalThis-backed in-memory persistence
 *
 * Mirrors the CognitiveState store pattern. Tracks facilitator-side state
 * that agents need to know: active theme, theme queue, journey data,
 * freeflow mode, dialogue phase.
 *
 * The cognitive guidance page PUTs to the guidance-state API when
 * the facilitator takes action, and agents read this before invoking.
 */

import type { DialoguePhase, Lens } from '@/lib/cognitive-guidance/pipeline';
import type { WorkshopPrepResearch, WorkshopIntelligence } from './agents/agent-types';

// ══════════════════════════════════════════════════════════
// GUIDED THEME — agent-suggested or facilitator-created themes
// ══════════════════════════════════════════════════════════

export type ThemeSource = 'seed' | 'ai' | 'facilitator';

export type GuidedTheme = {
  id: string;
  title: string;
  description: string;
  lens: Lens | null;
  source: ThemeSource;
  status: 'queued' | 'active' | 'completed';
  order: number;
  startedAtMs: number | null;
  completedAtMs: number | null;
  sourceSignalIds: string[];
};

// ══════════════════════════════════════════════════════════
// CONSTRAINT FLAG — mapped to journey interactions
// ══════════════════════════════════════════════════════════

export type ConstraintFlag = {
  id: string;
  type: 'regulatory' | 'technical' | 'organisational' | 'people' | 'customer' | 'budget';
  label: string;
  severity: 'blocking' | 'significant' | 'manageable';
  sourceNodeIds: string[];
  addedBy: 'ai' | 'facilitator';
};

// ══════════════════════════════════════════════════════════
// GUIDANCE STATE — facilitator-side state that agents read
// ══════════════════════════════════════════════════════════

export type GuidanceState = {
  workshopId: string;
  activeThemeId: string | null;
  themes: GuidedTheme[];
  freeflowMode: boolean;
  dialoguePhase: DialoguePhase;
  lastUpdatedAtMs: number;

  // Pre-workshop intelligence (loaded once at session start)
  prepContext: {
    clientName: string | null;
    industry: string | null;
    dreamTrack: 'ENTERPRISE' | 'DOMAIN' | null;
    targetDomain: string | null;
    research: WorkshopPrepResearch | null;
    discoveryIntelligence: WorkshopIntelligence | null;
  } | null;

  // Agent orchestration tracking
  lastThemeCheckAtMs: number;
  lastPadGenerationAtMs: number;
  utterancesSinceLastPad: number;
};

// ══════════════════════════════════════════════════════════
// STORE
// ══════════════════════════════════════════════════════════

type GuidanceStore = {
  stateByWorkshop: Map<string, GuidanceState>;
};

function getStore(): GuidanceStore {
  const g = globalThis as typeof globalThis & { __dreamGuidanceStore?: GuidanceStore };
  if (!g.__dreamGuidanceStore) {
    g.__dreamGuidanceStore = {
      stateByWorkshop: new Map(),
    };
  }
  return g.__dreamGuidanceStore;
}

// ══════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════

export function getGuidanceState(workshopId: string): GuidanceState | null {
  return getStore().stateByWorkshop.get(workshopId) ?? null;
}

export function getOrCreateGuidanceState(
  workshopId: string,
  dialoguePhase: DialoguePhase = 'REIMAGINE',
): GuidanceState {
  const store = getStore();
  const existing = store.stateByWorkshop.get(workshopId);
  if (existing) return existing;

  const state: GuidanceState = {
    workshopId,
    activeThemeId: null,
    themes: [],
    freeflowMode: false,
    dialoguePhase,
    lastUpdatedAtMs: Date.now(),
    prepContext: null,
    lastThemeCheckAtMs: 0,
    lastPadGenerationAtMs: 0,
    utterancesSinceLastPad: 0,
  };

  store.stateByWorkshop.set(workshopId, state);
  return state;
}

export function updateGuidanceState(
  workshopId: string,
  updates: Partial<Pick<
    GuidanceState,
    'activeThemeId' | 'themes' | 'freeflowMode' | 'dialoguePhase' | 'prepContext'
  >>,
): GuidanceState {
  const state = getOrCreateGuidanceState(workshopId);

  if (updates.activeThemeId !== undefined) state.activeThemeId = updates.activeThemeId;
  if (updates.themes !== undefined) state.themes = updates.themes;
  if (updates.freeflowMode !== undefined) state.freeflowMode = updates.freeflowMode;
  if (updates.dialoguePhase !== undefined) state.dialoguePhase = updates.dialoguePhase;
  if (updates.prepContext !== undefined) state.prepContext = updates.prepContext;

  state.lastUpdatedAtMs = Date.now();
  return state;
}

export function removeGuidanceState(workshopId: string): void {
  getStore().stateByWorkshop.delete(workshopId);
}

// ══════════════════════════════════════════════════════════
// SEED THEMES — initial theme queue based on Discovery data
// ══════════════════════════════════════════════════════════

let _themeIdCounter = 0;
function nextThemeId(): string {
  return `theme_${Date.now()}_${++_themeIdCounter}`;
}

/**
 * Generate seed themes for the workshop. When Discovery intelligence is
 * available, themes are grounded in actual participant data. Otherwise
 * falls back to generic DREAM themes.
 */
export function getSeedThemes(
  discoveryIntelligence?: WorkshopIntelligence | null,
  dreamTrack?: 'ENTERPRISE' | 'DOMAIN' | null,
  targetDomain?: string | null,
): GuidedTheme[] {
  const themes: GuidedTheme[] = [];
  let order = 0;

  if (discoveryIntelligence) {
    // ── Intelligent seeds from Discovery data ────────

    // Top pain points → themes
    const topPains = discoveryIntelligence.painPoints
      .sort((a, b) => {
        const sev = { critical: 3, significant: 2, moderate: 1 };
        return (sev[b.severity] || 0) - (sev[a.severity] || 0);
      })
      .slice(0, 3);

    for (const pain of topPains) {
      themes.push({
        id: nextThemeId(),
        title: `Address: ${pain.description.substring(0, 60)}`,
        description: `Pain point identified by ${pain.frequency} participants (${pain.severity})`,
        lens: pain.domain as Lens,
        source: 'seed',
        status: 'queued',
        order: order++,
        startedAtMs: null,
        completedAtMs: null,
        sourceSignalIds: [],
      });
    }

    // Highest maturity gaps → themes
    const gaps = discoveryIntelligence.maturitySnapshot
      .map((m) => ({ ...m, gap: m.targetMedian - m.todayMedian }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 2);

    for (const gap of gaps) {
      themes.push({
        id: nextThemeId(),
        title: `${gap.domain}: Close the Gap`,
        description: `Gap of ${gap.gap.toFixed(1)} between today (${gap.todayMedian}) and target (${gap.targetMedian})`,
        lens: gap.domain as Lens,
        source: 'seed',
        status: 'queued',
        order: order++,
        startedAtMs: null,
        completedAtMs: null,
        sourceSignalIds: [],
      });
    }

    // Consensus areas → build-on themes
    for (const consensus of discoveryIntelligence.consensusAreas.slice(0, 1)) {
      themes.push({
        id: nextThemeId(),
        title: `Build on: ${consensus.substring(0, 60)}`,
        description: 'Area of strong consensus across participants',
        lens: null,
        source: 'seed',
        status: 'queued',
        order: order++,
        startedAtMs: null,
        completedAtMs: null,
        sourceSignalIds: [],
      });
    }

    // Divergence areas → resolve themes
    for (const div of discoveryIntelligence.divergenceAreas.slice(0, 1)) {
      themes.push({
        id: nextThemeId(),
        title: `Resolve: ${div.topic.substring(0, 60)}`,
        description: `Divergent views: ${div.perspectives.slice(0, 2).join(' vs ')}`,
        lens: null,
        source: 'seed',
        status: 'queued',
        order: order++,
        startedAtMs: null,
        completedAtMs: null,
        sourceSignalIds: [],
      });
    }
  } else {
    // ── Generic fallback seeds ───────────────────────

    const genericThemes: Array<{ title: string; description: string; lens: Lens | null }> = [
      {
        title: 'Ideal Future State',
        description: 'Paint a picture of success without constraints — what does the ideal look like?',
        lens: null,
      },
      {
        title: 'Key Actors & Stakeholders',
        description: 'Who plays what role in this future? Map the people and teams involved.',
        lens: 'People' as Lens,
      },
      {
        title: 'Customer Experience',
        description: 'What changes for the customer? Map the ideal journey.',
        lens: 'Customer' as Lens,
      },
      {
        title: 'People & Organisation',
        description: 'How do people fit into this future? Skills, roles, culture.',
        lens: 'People' as Lens,
      },
      {
        title: 'Business Outcomes',
        description: 'What are the top 3 measurable outcomes we want to achieve?',
        lens: null,
      },
    ];

    // Domain track: weight toward target domain
    if (dreamTrack === 'DOMAIN' && targetDomain) {
      genericThemes.unshift({
        title: `${targetDomain} — Current State`,
        description: `Map the current state of ${targetDomain} — what works, what doesn\'t.`,
        lens: null,
      });
    }

    for (const t of genericThemes) {
      themes.push({
        id: nextThemeId(),
        title: t.title,
        description: t.description,
        lens: t.lens,
        source: 'seed',
        status: 'queued',
        order: order++,
        startedAtMs: null,
        completedAtMs: null,
        sourceSignalIds: [],
      });
    }
  }

  return themes;
}

// ── Periodic Cleanup ────────────────────────────────────────
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const store = getStore();
    for (const [id, state] of store.stateByWorkshop.entries()) {
      if (now - state.lastUpdatedAtMs > STALE_THRESHOLD_MS) {
        store.stateByWorkshop.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}
