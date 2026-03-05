/**
 * Engagement Type Configuration
 *
 * Defines the different engagement types available for workshops.
 * Each engagement type configures the diagnostic approach, output emphasis,
 * and suggested session mix for field discovery.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionMixSuggestion {
  captureType: string;
  minSessions: number;
  idealSessions: number;
  description: string;
}

export interface EngagementTypeConfig {
  key: string;
  label: string;
  description: string;
  diagnosticFocus: string;
  outputEmphasis: string[];
  suggestedSessionMix: SessionMixSuggestion[];
  typicalDurationDays: number;
  typicalInterviewCount: string; // e.g. "30-50"
}

// ---------------------------------------------------------------------------
// Engagement Type Definitions
// ---------------------------------------------------------------------------

const DIAGNOSTIC_BASELINE: EngagementTypeConfig = {
  key: 'diagnostic_baseline',
  label: 'Diagnostic Baseline',
  description: 'Establish a clear picture of current state across all lenses before any transformation begins',
  diagnosticFocus: 'Current state assessment with evidence-based severity scoring',
  outputEmphasis: [
    'Per-lens maturity scores',
    'Severity-ranked findings',
    'Quick win candidates',
    'Baseline metrics for tracking',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 3, idealSessions: 5, description: 'Senior leadership perspective' },
    { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Middle management operational view' },
    { captureType: 'operational_interview', minSessions: 10, idealSessions: 25, description: 'Front-line staff reality' },
    { captureType: 'walkaround', minSessions: 2, idealSessions: 5, description: 'Physical observation and ad-hoc capture' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '30-50',
};

const OPERATIONAL_DEEP_DIVE: EngagementTypeConfig = {
  key: 'operational_deep_dive',
  label: 'Operational Deep Dive',
  description: 'Focused investigation into specific operational pain points with root cause analysis',
  diagnosticFocus: 'Root cause analysis of operational friction and process breakdowns',
  outputEmphasis: [
    'Process friction maps',
    'Root cause chains',
    'Workaround inventory',
    'Operational quick wins with effort/impact scoring',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 2, idealSessions: 3, description: 'Strategic context and priorities' },
    { captureType: 'manager_interview', minSessions: 5, idealSessions: 8, description: 'Process ownership and constraints' },
    { captureType: 'operational_interview', minSessions: 15, idealSessions: 30, description: 'Detailed operational experience' },
    { captureType: 'walkaround', minSessions: 3, idealSessions: 8, description: 'Observe processes in action' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '35-55',
};

const AI_ENABLEMENT: EngagementTypeConfig = {
  key: 'ai_enablement',
  label: 'AI Enablement',
  description: 'Assess readiness for AI adoption and identify high-value automation opportunities',
  diagnosticFocus: 'AI readiness assessment with use case identification and feasibility scoring',
  outputEmphasis: [
    'AI readiness per function',
    'Use case catalogue with feasibility scores',
    'Data readiness assessment',
    'Change readiness and cultural barriers',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 3, idealSessions: 5, description: 'AI strategy and investment appetite' },
    { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Operational AI use case identification' },
    { captureType: 'operational_interview', minSessions: 10, idealSessions: 20, description: 'Task-level automation candidates' },
    { captureType: 'walkaround', minSessions: 2, idealSessions: 4, description: 'Observe manual processes ripe for AI' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '25-45',
};

const TRANSFORMATION_SPRINT: EngagementTypeConfig = {
  key: 'transformation_sprint',
  label: 'Transformation Sprint',
  description: 'Rapid diagnostic and solution design for time-critical transformation programmes',
  diagnosticFocus: 'Fast-cycle diagnostic with immediate action planning',
  outputEmphasis: [
    '30/60/90 day action plan',
    'Critical path dependencies',
    'Risk register with mitigations',
    'Stakeholder alignment map',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 3, idealSessions: 6, description: 'Transformation vision and governance' },
    { captureType: 'manager_interview', minSessions: 8, idealSessions: 15, description: 'Implementation reality and blockers' },
    { captureType: 'operational_interview', minSessions: 10, idealSessions: 20, description: 'Change impact and readiness' },
    { captureType: 'walkaround', minSessions: 2, idealSessions: 4, description: 'Current state observation' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '30-50',
};

const CULTURAL_ALIGNMENT: EngagementTypeConfig = {
  key: 'cultural_alignment',
  label: 'Cultural Alignment',
  description: 'Diagnose cultural gaps, leadership alignment, and organisational values in practice',
  diagnosticFocus: 'Culture assessment with leadership-frontline perception gap analysis',
  outputEmphasis: [
    'Values-in-practice assessment',
    'Leadership vs frontline perception gaps',
    'Cultural enablers and blockers',
    'Engagement and psychological safety indicators',
  ],
  suggestedSessionMix: [
    { captureType: 'executive_interview', minSessions: 3, idealSessions: 6, description: 'Leadership values and expectations' },
    { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Culture translation and implementation' },
    { captureType: 'operational_interview', minSessions: 15, idealSessions: 30, description: 'Lived cultural experience' },
    { captureType: 'walkaround', minSessions: 3, idealSessions: 6, description: 'Observe cultural artefacts and behaviours' },
  ],
  typicalDurationDays: 2,
  typicalInterviewCount: '35-55',
};

// ---------------------------------------------------------------------------
// Registry map + lookup
// ---------------------------------------------------------------------------

export const ENGAGEMENT_TYPES: Record<string, EngagementTypeConfig> = {
  diagnostic_baseline: DIAGNOSTIC_BASELINE,
  operational_deep_dive: OPERATIONAL_DEEP_DIVE,
  ai_enablement: AI_ENABLEMENT,
  transformation_sprint: TRANSFORMATION_SPRINT,
  cultural_alignment: CULTURAL_ALIGNMENT,
};

/**
 * Get an engagement type config by key. Returns null if unknown.
 */
export function getEngagementType(key: string): EngagementTypeConfig | null {
  return ENGAGEMENT_TYPES[key] ?? null;
}

/**
 * List all available engagement type keys with labels.
 */
export function listEngagementTypes(): Array<{ key: string; label: string }> {
  return Object.values(ENGAGEMENT_TYPES).map((et) => ({
    key: et.key,
    label: et.label,
  }));
}
