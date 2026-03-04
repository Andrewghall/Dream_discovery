/**
 * Workshop Blueprint -- first-class runtime configuration model.
 *
 * Every workshop carries a blueprint JSON snapshot that captures all
 * runtime-relevant config: lens policy, journey template, actor taxonomy,
 * question policy, pacing, agent chain, signal policy, confidence rules,
 * and data requirements.
 *
 * Composed at workshop creation/update from:
 *   1. DEFAULT_BLUEPRINT (safe hardcoded fallbacks)
 *   2. Engagement type overrides
 *   3. Domain pack overrides
 *   4. Workshop scalar fields
 *
 * Downstream tasks read `getBlueprint(workshop.blueprint)` instead of
 * scattered hardcoded constants.
 */

import { z } from 'zod';
import { getDomainPack } from '@/lib/domain-packs/registry';
import { getEngagementType } from '@/lib/domain-packs/engagement-types';
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_JOURNEY_STAGES,
} from '@/lib/cognition/workshop-dimensions';

// ================================================================
// Sub-types
// ================================================================

export type LensPolicyEntry = {
  name: string;
  description: string;
  color: string;
  keywords: string[];
};

export type PhaseLensPolicy = {
  REIMAGINE: string[];
  CONSTRAINTS: string[];
  DEFINE_APPROACH: string[];
};

export type JourneyStageEntry = {
  name: string;
  description: string;
};

export type ActorEntry = {
  key: string;
  label: string;
  description: string;
};

export type QuestionPolicy = {
  questionsPerPhase: number;
  subQuestionsPerMain: number;
  coverageThresholdPercent: number;
};

export type SessionMixEntry = {
  captureType: string;
  minSessions: number;
  idealSessions: number;
  description: string;
};

export type DataRequirements = {
  typicalDurationDays: number;
  typicalInterviewCount: string;
  sessionMix: SessionMixEntry[];
};

export type ConfidenceRules = {
  classificationThreshold: number;
  beliefStabilisationThreshold: number;
};

export type PacingConfig = {
  minEmissionIntervalMs: number;
  padGenerationIntervalMs: number;
  padUtteranceThreshold: number;
  maxVisiblePads: number;
};

export type AgentChainEntry = {
  agentId: string;
  enabled: boolean;
  maxIterations: number;
  timeoutMs: number;
  model: string;
};

export type SignalPolicy = {
  enabledSignalTypes: string[];
  phaseAllowedSignals: Record<string, string[]>;
};

export type FindingPolicy = {
  enabledFindingTypes: string[];
};

export type QuestionConstraints = {
  requiredTopics: string[];
  forbiddenTopics: string[];
  focusAreas: string[];
  domainMetrics: string[];
};

// ================================================================
// Top-level blueprint type
// ================================================================

export type WorkshopBlueprint = {
  version: number;

  // Identity
  industry: string | null;
  dreamTrack: 'ENTERPRISE' | 'DOMAIN' | null;
  engagementType: string | null;
  domainPack: string | null;
  purpose: string | null;
  outcomes: string | null;

  // Lens policy
  lenses: LensPolicyEntry[];
  phaseLensPolicy: PhaseLensPolicy;

  // Journey template
  journeyStages: JourneyStageEntry[];

  // Actor taxonomy
  actorTaxonomy: ActorEntry[];

  // Question policy
  questionPolicy: QuestionPolicy;

  // Question constraints (domain-specific topic guidance)
  questionConstraints: QuestionConstraints;

  // Data requirements
  dataRequirements: DataRequirements;

  // Confidence rules
  confidenceRules: ConfidenceRules;

  // Pacing (live runtime)
  pacing: PacingConfig;

  // Agent chain
  agentChain: AgentChainEntry[];

  // Signal policy
  signalPolicy: SignalPolicy;

  // Finding policy
  findingPolicy: FindingPolicy;

  // Engagement metadata
  diagnosticFocus: string | null;
  outputEmphasis: string[];

  // Timestamp
  composedAtMs: number;
};

// ================================================================
// Zod sub-schemas
// ================================================================

const LensPolicyEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  color: z.string(),
  keywords: z.array(z.string()),
});

const PhaseLensPolicySchema = z.object({
  REIMAGINE: z.array(z.string()),
  CONSTRAINTS: z.array(z.string()),
  DEFINE_APPROACH: z.array(z.string()),
});

const JourneyStageEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
});

const ActorEntrySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
});

const QuestionPolicySchema = z.object({
  questionsPerPhase: z.number().int().min(1).max(20),
  subQuestionsPerMain: z.number().int().min(0).max(10),
  coverageThresholdPercent: z.number().min(0).max(100),
});

const SessionMixEntrySchema = z.object({
  captureType: z.string(),
  minSessions: z.number().int().min(0),
  idealSessions: z.number().int().min(0),
  description: z.string(),
});

const DataRequirementsSchema = z.object({
  typicalDurationDays: z.number().int().min(1),
  typicalInterviewCount: z.string(),
  sessionMix: z.array(SessionMixEntrySchema),
});

const ConfidenceRulesSchema = z.object({
  classificationThreshold: z.number().min(0).max(1),
  beliefStabilisationThreshold: z.number().min(0).max(1),
});

const PacingConfigSchema = z.object({
  minEmissionIntervalMs: z.number().int().min(0),
  padGenerationIntervalMs: z.number().int().min(0),
  padUtteranceThreshold: z.number().int().min(1),
  maxVisiblePads: z.number().int().min(1),
});

const AgentChainEntrySchema = z.object({
  agentId: z.string().min(1),
  enabled: z.boolean(),
  maxIterations: z.number().int().min(1),
  timeoutMs: z.number().int().min(1000),
  model: z.string().min(1),
});

const SignalPolicySchema = z.object({
  enabledSignalTypes: z.array(z.string()),
  phaseAllowedSignals: z.record(z.string(), z.array(z.string())),
});

const FindingPolicySchema = z.object({
  enabledFindingTypes: z.array(z.string()),
});

const QuestionConstraintsSchema = z.object({
  requiredTopics: z.array(z.string()),
  forbiddenTopics: z.array(z.string()),
  focusAreas: z.array(z.string()),
  domainMetrics: z.array(z.string()),
});

// ================================================================
// Top-level Zod schema
// ================================================================

export const WorkshopBlueprintSchema = z.object({
  version: z.number().int().min(1),

  industry: z.string().nullable(),
  dreamTrack: z.enum(['ENTERPRISE', 'DOMAIN']).nullable(),
  engagementType: z.string().nullable(),
  domainPack: z.string().nullable(),
  purpose: z.string().nullable(),
  outcomes: z.string().nullable(),

  lenses: z.array(LensPolicyEntrySchema).min(1),
  phaseLensPolicy: PhaseLensPolicySchema,

  journeyStages: z.array(JourneyStageEntrySchema).min(1),

  actorTaxonomy: z.array(ActorEntrySchema),

  questionPolicy: QuestionPolicySchema,
  questionConstraints: QuestionConstraintsSchema,
  dataRequirements: DataRequirementsSchema,
  confidenceRules: ConfidenceRulesSchema,

  pacing: PacingConfigSchema,
  agentChain: z.array(AgentChainEntrySchema),
  signalPolicy: SignalPolicySchema,
  findingPolicy: FindingPolicySchema,

  diagnosticFocus: z.string().nullable(),
  outputEmphasis: z.array(z.string()),

  composedAtMs: z.number(),
});

// ================================================================
// DEFAULT_BLUEPRINT -- safe fallbacks for all runtime values
// ================================================================

/**
 * Build default lenses from the workshop-dimensions single source of truth.
 * DEFAULT_DIMENSIONS carries name, description, keywords, and color.
 */
function buildDefaultLenses(): LensPolicyEntry[] {
  return DEFAULT_DIMENSIONS.map((d) => ({
    name: d.name,
    description: d.description,
    color: d.color,
    keywords: [...d.keywords],
  }));
}

/**
 * Build default journey stages from the workshop-dimensions source of truth.
 */
function buildDefaultJourneyStages(): JourneyStageEntry[] {
  return DEFAULT_JOURNEY_STAGES.map((name) => ({
    name,
    description: '',
  }));
}

export const DEFAULT_BLUEPRINT: WorkshopBlueprint = {
  version: 1,

  // Identity -- null defaults, composed from workshop fields
  industry: null,
  dreamTrack: null,
  engagementType: null,
  domainPack: null,
  purpose: null,
  outcomes: null,

  // Lenses from workshop-dimensions.ts DEFAULT_DIMENSIONS
  lenses: buildDefaultLenses(),

  // Phase lens policy
  // Note: pipeline.ts REIMAGINE_LENSES uses 'Organisation', workshop-dimensions
  // uses 'Operations'. Both are included for compatibility until normalised.
  phaseLensPolicy: {
    REIMAGINE: ['People', 'Customer', 'Organisation'],
    CONSTRAINTS: DEFAULT_DIMENSIONS.map((d) => d.name),
    DEFINE_APPROACH: DEFAULT_DIMENSIONS.map((d) => d.name),
  },

  // Journey stages from workshop-dimensions.ts DEFAULT_JOURNEY_STAGES
  journeyStages: buildDefaultJourneyStages(),

  // Actor taxonomy -- empty by default (populated by domain pack)
  actorTaxonomy: [],

  // Question policy
  questionPolicy: {
    questionsPerPhase: 5,
    subQuestionsPerMain: 3,
    coverageThresholdPercent: 70,
  },

  // Question constraints -- empty by default, populated by generator
  questionConstraints: {
    requiredTopics: [],
    forbiddenTopics: [],
    focusAreas: [],
    domainMetrics: [],
  },

  // Data requirements -- from DIAGNOSTIC_BASELINE engagement type defaults
  dataRequirements: {
    typicalDurationDays: 2,
    typicalInterviewCount: '30-50',
    sessionMix: [
      { captureType: 'executive_interview', minSessions: 3, idealSessions: 5, description: 'Senior leadership perspective' },
      { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Middle management operational view' },
      { captureType: 'operational_interview', minSessions: 10, idealSessions: 25, description: 'Front-line staff reality' },
      { captureType: 'walkaround', minSessions: 2, idealSessions: 5, description: 'Physical observation and ad-hoc capture' },
    ],
  },

  // Confidence rules -- from pipeline.ts CONFIDENCE_THRESHOLD
  confidenceRules: {
    classificationThreshold: 0.4,
    beliefStabilisationThreshold: 0.4,
  },

  // Pacing -- from facilitation-orchestrator.ts
  pacing: {
    minEmissionIntervalMs: 120_000,
    padGenerationIntervalMs: 45_000,
    padUtteranceThreshold: 6,
    maxVisiblePads: 4,
  },

  // Agent chain -- from each agent file's constants
  agentChain: [
    { agentId: 'research', enabled: true, maxIterations: 15, timeoutMs: 150_000, model: 'gpt-4o' },
    { agentId: 'question_set', enabled: true, maxIterations: 6, timeoutMs: 40_000, model: 'gpt-4o-mini' },
    { agentId: 'discovery_question', enabled: true, maxIterations: 12, timeoutMs: 60_000, model: 'gpt-4o-mini' },
    { agentId: 'discovery_intelligence', enabled: true, maxIterations: 5, timeoutMs: 40_000, model: 'gpt-4o-mini' },
    { agentId: 'guardian', enabled: true, maxIterations: 2, timeoutMs: 5_000, model: 'gpt-4o-mini' },
    { agentId: 'facilitation', enabled: true, maxIterations: 3, timeoutMs: 8_000, model: 'gpt-4o-mini' },
    { agentId: 'facilitation_orchestrator', enabled: true, maxIterations: 6, timeoutMs: 30_000, model: 'gpt-4o-mini' },
  ],

  // Signal policy -- from pipeline.ts PHASE_ALLOWED_SIGNALS
  signalPolicy: {
    enabledSignalTypes: [
      'repeated_theme',
      'missing_dimension',
      'contradiction',
      'high_freq_constraint',
      'unanswered_question',
      'weak_enabler',
      'risk_cluster',
    ],
    phaseAllowedSignals: {
      SYNTHESIS: ['repeated_theme', 'missing_dimension', 'contradiction'],
      REIMAGINE: ['repeated_theme', 'missing_dimension', 'unanswered_question', 'contradiction'],
      CONSTRAINTS: [
        'repeated_theme', 'missing_dimension', 'contradiction',
        'high_freq_constraint', 'unanswered_question', 'weak_enabler', 'risk_cluster',
      ],
      DEFINE_APPROACH: [
        'repeated_theme', 'missing_dimension', 'contradiction',
        'unanswered_question', 'weak_enabler',
      ],
    },
  },

  // Finding policy -- from FindingType enum
  findingPolicy: {
    enabledFindingTypes: ['CONSTRAINT', 'OPPORTUNITY', 'RISK', 'CONTRADICTION'],
  },

  // Engagement metadata
  diagnosticFocus: null,
  outputEmphasis: [],

  composedAtMs: 0,
};

// ================================================================
// Composition
// ================================================================

export type ComposeInput = {
  industry: string | null;
  dreamTrack: 'ENTERPRISE' | 'DOMAIN' | null;
  engagementType: string | null;
  domainPack: string | null;
  purpose: string | null;
  outcomes: string | null;
};

/**
 * Compose a validated WorkshopBlueprint by layering:
 *   1. DEFAULT_BLUEPRINT
 *   2. Engagement type overrides
 *   3. Domain pack overrides
 *   4. Workshop identity scalars
 *
 * On validation failure, logs a warning and returns a safe default.
 */
export function composeBlueprint(input: ComposeInput): WorkshopBlueprint {
  const bp: WorkshopBlueprint = structuredClone(DEFAULT_BLUEPRINT);

  // Layer 1: Workshop identity scalars
  bp.industry = input.industry;
  bp.dreamTrack = input.dreamTrack;
  bp.engagementType = input.engagementType;
  bp.domainPack = input.domainPack;
  bp.purpose = input.purpose;
  bp.outcomes = input.outcomes;

  // Layer 2: Engagement type overrides
  if (input.engagementType) {
    // Registry uses lowercase keys; Prisma stores uppercase enums
    const etKey = input.engagementType.toLowerCase();
    const etConfig = getEngagementType(etKey);
    if (etConfig) {
      bp.diagnosticFocus = etConfig.diagnosticFocus;
      bp.outputEmphasis = [...etConfig.outputEmphasis];
      bp.dataRequirements = {
        typicalDurationDays: etConfig.typicalDurationDays,
        typicalInterviewCount: etConfig.typicalInterviewCount,
        sessionMix: etConfig.suggestedSessionMix.map((s) => ({
          captureType: s.captureType,
          minSessions: s.minSessions,
          idealSessions: s.idealSessions,
          description: s.description,
        })),
      };
    }
  }

  // Layer 3: Domain pack overrides
  if (input.domainPack) {
    const pack = getDomainPack(input.domainPack);
    if (pack) {
      // Map domain pack lenses to LensPolicyEntry, reusing DEFAULT_DIMENSIONS
      // data (keywords, color, description) when the name matches.
      const defaultLookup = new Map(
        DEFAULT_DIMENSIONS.map((d) => [d.name, d]),
      );

      bp.lenses = pack.lenses.map((lensName) => {
        // Domain packs use LensName which may be 'Organisation' while
        // DEFAULT_DIMENSIONS uses 'Operations'. Check both.
        const match =
          defaultLookup.get(lensName) ||
          defaultLookup.get(lensName === 'Organisation' ? 'Operations' : lensName);
        if (match) {
          return {
            name: match.name,
            description: match.description,
            color: match.color,
            keywords: [...match.keywords],
          };
        }
        // Unknown lens from pack -- create a minimal entry
        return {
          name: lensName,
          description: '',
          color: '#e2e8f0',
          keywords: [],
        };
      });

      // Update phase lens policy to match available lenses
      const lensNames = bp.lenses.map((l) => l.name);
      // REIMAGINE restricts to people/customer/org dimensions
      const reimagineSet = new Set(['People', 'Customer', 'Organisation', 'Operations']);
      bp.phaseLensPolicy = {
        REIMAGINE: lensNames.filter((n) => reimagineSet.has(n)),
        CONSTRAINTS: [...lensNames],
        DEFINE_APPROACH: [...lensNames],
      };

      // Actor taxonomy from domain pack
      bp.actorTaxonomy = pack.actorTaxonomy.map((a) => ({
        key: a.key,
        label: a.label,
        description: a.description,
      }));
    }
  }

  // Stamp composition time
  bp.composedAtMs = Date.now();

  // Validate
  const result = WorkshopBlueprintSchema.safeParse(bp);
  if (!result.success) {
    console.error(
      '[blueprint] Validation failed, returning safe defaults',
      result.error.issues,
    );
    return { ...structuredClone(DEFAULT_BLUEPRINT), composedAtMs: Date.now() };
  }

  return result.data as WorkshopBlueprint;
}

// ================================================================
// Database readers
// ================================================================

/**
 * Safely parse a blueprint from a JSON value (database column).
 * Returns the validated blueprint, or null if the value is absent or invalid.
 */
export function readBlueprintFromJson(
  json: unknown,
): WorkshopBlueprint | null {
  if (json === null || json === undefined) return null;
  const result = WorkshopBlueprintSchema.safeParse(json);
  if (!result.success) {
    console.warn(
      '[blueprint] Invalid blueprint JSON, returning null',
      result.error.issues,
    );
    return null;
  }
  return result.data as WorkshopBlueprint;
}

/**
 * Read a blueprint from JSON, falling back to DEFAULT_BLUEPRINT if absent
 * or invalid. This is the primary entry point for runtime code.
 */
export function getBlueprint(json: unknown): WorkshopBlueprint {
  return (
    readBlueprintFromJson(json) ?? {
      ...structuredClone(DEFAULT_BLUEPRINT),
      composedAtMs: Date.now(),
    }
  );
}
