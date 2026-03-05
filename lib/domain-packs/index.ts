/**
 * Domain Packs - Re-exports
 *
 * Central entry point for domain pack and engagement type configuration.
 */

export {
  DOMAIN_PACKS,
  getDomainPack,
  listDomainPacks,
} from './registry';

export type {
  DomainPack,
  ActorRole,
  MetricReference,
  QuestionTemplate,
  DiagnosticOutputField,
} from './registry';

export {
  ENGAGEMENT_TYPES,
  getEngagementType,
  listEngagementTypes,
} from './engagement-types';

export type {
  EngagementTypeConfig,
  SessionMixSuggestion,
} from './engagement-types';
