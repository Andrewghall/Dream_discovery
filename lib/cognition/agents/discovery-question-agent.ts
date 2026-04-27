/**
 * DREAM Discovery Question Agent -- Per-Lens Interview Questions
 *
 * A GPT-4o-mini tool-calling agent that generates tailored Discovery
 * interview questions for each lens in a workshop's domain pack.
 *
 * The agent uses:
 *   - Domain pack templates (lenses, question templates)
 *   - Company research (from Research Agent)
 *   - Workshop context (purpose, outcomes, client, industry)
 *
 * For each lens the agent produces:
 *   1 maturity rating question (5-level scale)
 *   3-4 exploratory questions (strengths, gaps, friction, future, etc.)
 *
 * Questions are grounded in research findings and client context,
 * not generic templates.
 */

import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import { prisma } from '@/lib/prisma';
import type {
  WorkshopPrepResearch,
  PrepContext,
  LensName,
  LensSource,
} from './agent-types';
import type { DomainPack } from '@/lib/domain-packs/registry';
import { getDomainPack } from '@/lib/domain-packs/registry';
import { resolveIndustryPack } from '@/lib/domain-packs/resolution';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import {
  getEngagementTypeProfile,
  getWorkshopTypeProfile,
  inferCanonicalWorkshopType,
} from '@/lib/workshop/workshop-definition';
import {
  CANONICAL_LENS_NAMES,
  canonicalizeLensName,
  type CanonicalLensName,
} from '@/lib/workshop/canonical-lenses';
import { getWorkshopPack } from '@/lib/workshop/workshop-packs';
import {
  buildGtmIcpGoldReferenceBlock,
  getGtmGoldScaleAnchors,
  isExactGtmGoldQuestionForLens,
  getGtmGoldLens,
} from '@/lib/gold-data/gtm-icp-reference';
import {
  buildTransformationGoldReferenceBlock,
  getTransformationGoldSignals,
  isExactTransformationGoldQuestion,
} from '@/lib/gold-data/transformation-reference';
import {
  buildOperationsGoldReferenceBlock,
  getOperationsGoldDatasetRules,
  getOperationsGoldSignals,
  isExactOperationsGoldQuestion,
} from '@/lib/gold-data/operations-reference';
import {
  buildAiGoldReferenceBlock,
  getAiGoldSignals,
  isExactAiGoldQuestion,
} from '@/lib/gold-data/ai-reference';
import {
  buildFinanceGoldReferenceBlock,
  getFinanceGoldSignals,
  isExactFinanceGoldQuestion,
} from '@/lib/gold-data/finance-reference';
import {
  assertWorkshopContextIntegrity,
  decryptWorkshopContext,
} from '@/lib/workshop/context-integrity';
import { buildDiscoveryLensContractBlock, getDiscoveryLensContract } from '@/lib/workshop/discovery-stage-contracts';

// ── Types ────────────────────────────────────────────────────

export interface DiscoveryQuestion {
  id: string;
  text: string;
  tag: string;
  maturityScale?: string[];
  purpose: string;
  isEdited: boolean;
}

export interface DiscoveryLensQuestions {
  key: string;
  label: string;
  questions: DiscoveryQuestion[];
}

export interface DiscoveryQuestionSet {
  lenses: DiscoveryLensQuestions[];
  generatedAtMs: number;
  agentRationale: string;
  facilitatorDirection?: string | null;
}

export type DiscoveryQuestionAgentOptions = {
  direction?: string | null;
  blueprint?: WorkshopBlueprint | null;
};

export function sanitizeDiscoveryQuestionSet(
  questionSet: DiscoveryQuestionSet | null | undefined,
  blueprint?: WorkshopBlueprint | null,
): DiscoveryQuestionSet | null {
  if (!questionSet) return null;

  const allowedLensOrder = (blueprint?.lenses?.length
    ? blueprint.lenses
      .map((lens) => canonicalizeLensName(lens.name))
      .filter(Boolean)
    : [...CANONICAL_LENS_NAMES]) as string[];

  const allowedLensSet = new Set(allowedLensOrder);
  const sanitizedLenses: DiscoveryLensQuestions[] = [];
  for (const lens of questionSet.lenses) {
    const canonicalLens = canonicalizeLensName(lens.key) ?? canonicalizeLensName(lens.label);
    if (!canonicalLens || !allowedLensSet.has(canonicalLens)) continue;
    sanitizedLenses.push({
      ...lens,
      key: canonicalLens,
      label: canonicalLens,
    });
  }

  const orderedLenses: DiscoveryLensQuestions[] = [];
  for (const canonicalLens of allowedLensOrder) {
    const lens = sanitizedLenses.find((entry) => entry.key === canonicalLens);
    if (lens) orderedLenses.push(lens);
  }

  return {
    ...questionSet,
    lenses: orderedLenses,
  };
}

// ── Constants ────────────────────────────────────────────────

const MAX_ITERATIONS = 12;
const LOOP_TIMEOUT_MS = 60_000;
const MODEL = 'gpt-4o-mini';

const VALID_TAGS = [
  'triple_rating',
  'strengths',
  'gaps',
  'friction',
  'future',
  'working',
  'pain_points',
  'support',
  'constraint',
  'context',
] as const;

const FINANCIAL_TERMS = /\b(roi|ebitda|margin|margins|cost-to-serve|budget|budgets|funding|profit|profitability|revenue|cash flow|p&l|opex|capex|payback|financial|finance|pricing)\b/i;
const ROLE_SPECIFIC_KNOWLEDGE_TERMS = /\b(board|c-suite|executive committee|shareholder|investor|capital allocation|esg|enterprise strategy|corporate strategy)\b/i;
const ABSTRACT_STRATEGY_TERMS = /\b(strategic effectiveness|financial performance|investment discipline)\b/i;
const EXPLORATORY_STARTERS = /^(what happens|where do you see|where do |where does|where is |where are |where would |what makes it difficult|what works well|when |which parts?|which points?|what slows|what helps|what gets in the way|how often|what tends to happen)/i;
const GTM_EXPLORATORY_STARTERS = /^(what happens|where do you see|where do |what makes it difficult|what works well|when |which parts?|which points?|where does|what slows|what helps|what gets in the way|how often|what tends to happen|who do you win with|who do you lose with|when do you win|when do you lose|what are you actually being bought for|where does the proposition|where do deals|which clients|what do buyers)/i;
const GTM_COMMERCIAL_TERMS = /\b(win|wins|won|lose|loses|lost|loss|losses|deal|deals|buyer|buyers|customer|customers|client|clients|icp|segment|segments|pipeline|renewal|renewals|churn|positioning|proposition|value proposition|commercial|market|go-to-market|gtm|pricing|price|prices|revenue|margin|value|differentiat|sold|sale|delivery|promise|promised)\b/i;
const GTM_FORBIDDEN_FINANCIAL_TERMS = /\b(roi|ebitda|cash flow|p&l|opex|capex|budget|budgets|funding|investment discipline|financial performance|capital allocation)\b/i;
const GENERIC_MATURITY_LANGUAGE = /\b(how mature|maturity of|capability maturity|process maturity|system maturity|how effective|how efficient|operational maturity|team performance|internal efficiency)\b/i;

type DiscoveryValidationContext = {
  workshopType?: string | null;
};

export function isGoToMarketWorkshopType(workshopType: string | null | undefined): boolean {
  return inferCanonicalWorkshopType({ workshopType }) === 'GO_TO_MARKET';
}

export function isTransformationWorkshopType(workshopType: string | null | undefined): boolean {
  return inferCanonicalWorkshopType({ workshopType }) === 'TRANSFORMATION';
}

export function isOperationsWorkshopType(workshopType: string | null | undefined): boolean {
  return inferCanonicalWorkshopType({ workshopType }) === 'OPERATIONS';
}

export function isAiWorkshopType(workshopType: string | null | undefined): boolean {
  return inferCanonicalWorkshopType({ workshopType }) === 'AI';
}

export function isFinanceWorkshopType(workshopType: string | null | undefined): boolean {
  return inferCanonicalWorkshopType({ workshopType }) === 'FINANCE';
}

function exploratoryStarterPattern(workshopType: string | null | undefined): RegExp {
  return isGoToMarketWorkshopType(workshopType) ? GTM_EXPLORATORY_STARTERS : EXPLORATORY_STARTERS;
}

function usesForbiddenFinancialLanguage(
  text: string,
  workshopType: string | null | undefined,
): boolean {
  if (!FINANCIAL_TERMS.test(text)) return false;
  if (isFinanceWorkshopType(workshopType)) return false;
  if (!isGoToMarketWorkshopType(workshopType)) return true;
  return GTM_FORBIDDEN_FINANCIAL_TERMS.test(text);
}

function buildWorkshopSpecificQuestionDesignRules(workshopType: string | null | undefined): string {
  const canonicalType = inferCanonicalWorkshopType({ workshopType });
  const workshopPack = getWorkshopPack(workshopType);
  const contractBlock = (canonicalType === 'GO_TO_MARKET' || canonicalType === 'TRANSFORMATION' || canonicalType === 'OPERATIONS' || canonicalType === 'AI' || canonicalType === 'FINANCE')
    ? buildDiscoveryLensContractBlock(canonicalType, [...CANONICAL_LENS_NAMES])
    : '';

  if (canonicalType === 'GO_TO_MARKET') {
    const goldReference = buildGtmIcpGoldReferenceBlock();
    return `
GO-TO-MARKET / ICP MODE (MANDATORY):
This is a GTM / Strategy workshop. Every lens must be interpreted through this question:
"How does this area affect how the business wins, loses, and delivers value in the market?"

Do NOT default to internal maturity, process quality, generic team performance, or system efficiency questions.
Do NOT ask "how mature", "how effective", or "how efficient" in generic terms.

For this workshop type, discovery must surface commercial truth:
- who we win with
- why we win or lose
- what buyers think they are buying
- where revenue quality is weak or misaligned
- where the proposition breaks between sales and delivery

GTM lens interpretation rules:
- People: how people strengthen or weaken the ability to win the right work, defend the proposition, and build buyer trust.
- Operations: where delivery capability shapes what can be sold, where delivery breaks the promise made in the sale, and where the operating model limits commercial success.
- Technology: how technology enables, constrains, or differentiates the proposition, and where the technology reality falls short of what is promised to the market.
- Commercial: who the business wins with, who it loses with, what patterns exist in deals, what the buyer values, and what the market is actually buying.
- Customer: what customers experience after the sale, where trust is won or lost, and what drives retention, expansion, or churn.
- Risk/Compliance: where risk, procurement, approvals, or compliance shape deal viability, speed, and commercial opportunity.
- Partners: how partners strengthen or weaken the ability to win and deliver, and where partner dependencies create deal or delivery risk.

GTM question quality rules:
- Drive toward commercial insight, not internal maturity.
- Use real examples, win/loss patterns, buyer objections, client fit, delivery promises, renewal/churn signals, and proposition clarity.
- Prefer questions like:
  * "Who do you win with and what do they have in common?"
  * "When you lose deals, what tends to be the reason?"
  * "Where does delivery struggle to match what was sold?"
  * "What do buyers seem to value most when they choose you?"
  * "Which clients or deals feel attractive at the start but become hard to deliver well?"

RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):
${goldReference}

CRITICAL:
- Use the gold dataset to infer intent, signal shape, and evidence standard only.
- Do NOT copy gold example wording into the final questions.
- Every final question must be contextualised to the current company, industry, workshop purpose, desired outcomes, and research findings.
- If the same wording could be reused unchanged for another client, rewrite it.

PACK VALIDATION CONTRACT:
${workshopPack.validationDirective}

LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):
${contractBlock}
`;
  }

  if (canonicalType === 'TRANSFORMATION') {
    const goldReference = buildTransformationGoldReferenceBlock();
    return `
TRANSFORMATION MODE:
Interpret every lens through the future-state change agenda.

For this workshop type, discovery should surface:
- what is blocking strategic change
- where the current model will not support the future state
- which dependencies or behaviours slow transformation
- where signals from leadership ambition break in day-to-day reality

Transformation lens interpretation rules:
- People: readiness, confidence, change fatigue, leadership credibility, and where behaviours help or block change.
- Operations: where the current operating model, handoffs, or decision flow make the target state hard to reach.
- Technology: where technology enables or blocks the future state, and where current architecture constrains change.
- Commercial: where market expectations, customer promises, or growth priorities increase pressure for change.
- Customer: where journeys, trust, or service reality force transformation and what the future state must improve externally.
- Risk/Compliance: where controls, approvals, or governance help or slow transformation.
- Partners: where external dependencies accelerate or block the transformation path.

RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):
${goldReference}

CRITICAL:
- Use the gold dataset to infer signal shape, evidence standard, and decision pressure only.
- Do NOT copy gold example wording into the final questions.
- Every final question must be contextualised to the current company, industry, workshop purpose, desired outcomes, and research findings.
- If the same wording could be reused unchanged for another client, rewrite it.

PACK VALIDATION CONTRACT:
${workshopPack.validationDirective}

LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):
${contractBlock}
`;
  }

  if (canonicalType === 'OPERATIONS') {
    const goldReference = buildOperationsGoldReferenceBlock();
    return `
OPERATIONS MODE:
Interpret every lens through execution quality, bottlenecks, flow, and practical service performance.

For this workshop type, discovery should surface:
- where work gets stuck, repeated, or delayed
- what makes execution unreliable
- where frontline reality diverges from intended process
- what most directly improves performance and delivery

RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):
${goldReference}

CRITICAL:
- Use the gold dataset to infer signal shape, evidence standard, dataset grounding, and decision pressure only.
- Do NOT copy gold example wording into the final questions.
- Every final question must be contextualised to the current company, industry, workshop purpose, desired outcomes, and research findings.
- If the same wording could be reused unchanged for another client, rewrite it.

PACK VALIDATION CONTRACT:
${workshopPack.validationDirective}

LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):
${contractBlock}
`;
  }

  if (canonicalType === 'AI') {
    const goldReference = buildAiGoldReferenceBlock();
    return `
AI MODE:
Interpret every lens through practical AI readiness, use-case fit, implementation feasibility, adoption risk, and governance safety.

For this workshop type, discovery should surface:
- where AI could genuinely improve work or service quality
- where workflow, data, tooling, or exception complexity make AI unfit
- where governance, approval, or risk constraints shape what AI can do
- where adoption, trust, or capability will help or block implementation

RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):
${goldReference}

CRITICAL:
- Use the gold dataset to infer signal shape, evidence standard, and decision pressure only.
- Do NOT copy gold example wording into the final questions.
- Every final question must be contextualised to the current company, industry, workshop purpose, desired outcomes, and research findings.
- If the same wording could be reused unchanged for another client, rewrite it.

PACK VALIDATION CONTRACT:
${workshopPack.validationDirective}

LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):
${contractBlock}
`;
  }

  if (canonicalType === 'FINANCE') {
    const goldReference = buildFinanceGoldReferenceBlock();
    return `
FINANCE / VALUE OPTIMISATION MODE:
Interpret every lens through value creation, value leakage, cost-to-serve, and margin pressure.

For this workshop type, discovery should surface:
- where effort does not translate into value
- which clients, products, or work types feel commercially unattractive
- where waste, rework, or poor decisions erode margin
- what most improves value realisation without weakening delivery

RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):
${goldReference}

CRITICAL:
- Use the gold dataset to infer signal shape, evidence standard, and decision pressure only.
- Do NOT copy gold example wording into the final questions.
- Every final question must be contextualised to the current company, industry, workshop purpose, desired outcomes, and research findings.
- If the same wording could be reused unchanged for another client, rewrite it.

PACK VALIDATION CONTRACT:
${workshopPack.validationDirective}

LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):
${contractBlock}
`;
  }

  return '';
}

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const DISCOVERY_QUESTION_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_domain_pack_context',
      description:
        'Retrieve the domain pack configuration including the Discovery lenses and question templates. This gives you the starting templates for each lens.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_research_context',
      description:
        'Retrieve the Research Agent\'s findings about the client company -- company overview, industry context, challenges, competitive landscape, and domain insights.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workshop_context',
      description:
        'Retrieve the workshop purpose, desired outcomes, client name, industry, and business context.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'design_lens_questions',
      description:
        'Propose Discovery interview questions for a specific lens. Call this once per lens with 4-5 tailored questions. The first question MUST be a maturity rating question with a 5-level scale.',
      parameters: {
        type: 'object',
        properties: {
          lens: {
            type: 'string',
            description: 'The lens key (e.g. "People", "Organisation", "Customer", "Technology", "Regulation").',
          },
          label: {
            type: 'string',
            description: 'The human-readable label for this lens.',
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'The interview question text. For non-GTM exploratory questions, start with an observable starter such as "What happens", "Where do you see", "What makes it difficult", "What works well", "Where does", "What slows", "What helps", "What gets in the way", "Which parts", "Which points", "How often", or "What tends to happen". For GTM exploratory questions, use company-specific commercial wording that forces evidence from wins, losses, or live deals. Do NOT copy gold examples verbatim. Ask about one signal only, and use openings such as "Across recent wins and losses...", "In recent losses...", "In recent wins...", "Across live deals...", or "Which client opportunities...". For triple_rating, anchor the scoring in observable evidence: for GTM this can be recent wins, losses, live deals, buyer patterns, or delivery-against-promise signals; for non-GTM use day-to-day work. Do NOT start exploratory questions with "How", "Why", "What is leadership doing", or abstract strategy wording.',
                },
                tag: {
                  type: 'string',
                  enum: [
                    'triple_rating',
                    'strengths',
                    'gaps',
                    'friction',
                    'future',
                    'working',
                    'pain_points',
                    'support',
                    'constraint',
                    'context',
                  ],
                  description: 'The question category tag.',
                },
                maturityScale: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'For triple_rating questions only: 5 maturity levels from lowest (1) to highest (5). Each level is a short description.',
                },
                purpose: {
                  type: 'string',
                  description: 'Why this question matters -- what insight it aims to surface.',
                },
              },
              required: ['text', 'tag', 'purpose'],
            },
            description: 'The Discovery interview questions for this lens (4-5 questions).',
          },
        },
        required: ['lens', 'label', 'questions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_discovery_questions',
      description:
        'Finalise the complete Discovery question set. Call this after designing questions for ALL lenses. Include a rationale explaining the question strategy.',
      parameters: {
        type: 'object',
        properties: {
          rationale: {
            type: 'string',
            description:
              'A paragraph explaining the overall Discovery question strategy -- how questions are grounded in research, why certain topics are emphasised, and how they will surface the right insights from participants.',
          },
        },
        required: ['rationale'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeDiscoveryTool(
  toolName: string,
  args: Record<string, unknown>,
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  domainPack: DomainPack | null,
  designedLenses: Map<string, DiscoveryLensQuestions>,
): { result: string; summary: string } {
  switch (toolName) {
    case 'get_domain_pack_context': {
      if (!domainPack) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'No domain pack configured. Use the canonical workshop lenses from the blueprint: People, Operations, Technology, Commercial, Customer, Risk/Compliance, Partners.',
            defaultLenses: ['People', 'Operations', 'Technology', 'Commercial', 'Customer', 'Risk/Compliance', 'Partners'],
          }),
          summary: '**Domain pack:** Not configured. Using canonical workshop lenses from the blueprint.',
        };
      }

      const templatesByLens: Record<string, string[]> = {};
      for (const t of domainPack.questionTemplates) {
        if (!templatesByLens[t.lens]) templatesByLens[t.lens] = [];
        templatesByLens[t.lens].push(t.text);
      }

      const lensLines = domainPack.lenses.map((l) => {
        const templates = templatesByLens[l] || [];
        return `  - ${l}: ${templates.length} template(s)${templates.length > 0 ? '\n' + templates.map(t => `      * "${t}"`).join('\n') : ''}`;
      }).join('\n');

      return {
        result: JSON.stringify({
          available: true,
          packKey: domainPack.key,
          packLabel: domainPack.label,
          category: domainPack.category,
          lenses: domainPack.lenses,
          questionTemplates: domainPack.questionTemplates.map(t => ({
            lens: t.lens,
            text: t.text,
            purpose: t.purpose,
            captureTypes: t.captureTypes,
          })),
          actorTaxonomy: domainPack.actorTaxonomy.map(a => ({
            key: a.key,
            label: a.label,
            description: a.description,
          })),
          metricReferences: domainPack.metricReferences.map(m => ({
            key: m.key,
            label: m.label,
            unit: m.unit,
            description: m.description,
          })),
        }),
        summary: `**Domain pack: ${domainPack.label}** (${domainPack.category})\n\n**Lenses:**\n${lensLines}\n\n**Actor Taxonomy:** ${domainPack.actorTaxonomy.map(a => a.label).join(', ')}\n**Metrics:** ${domainPack.metricReferences.map(m => m.label).join(', ')}`,
      };
    }

    case 'get_research_context': {
      if (!research) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'No research available. Generate questions based on general industry knowledge and the domain pack templates.',
          }),
          summary: '**Research context:** Not available -- will use general industry knowledge.',
        };
      }

      const challengesList = research.keyPublicChallenges.length > 0
        ? research.keyPublicChallenges.map((c) => `  - ${c}`).join('\n')
        : '  (none identified)';
      const devsList = research.recentDevelopments.length > 0
        ? research.recentDevelopments.map((d) => `  - ${d}`).join('\n')
        : '  (none identified)';

      return {
        result: JSON.stringify({
          available: true,
          companyOverview: research.companyOverview,
          industryContext: research.industryContext,
          keyPublicChallenges: research.keyPublicChallenges,
          recentDevelopments: research.recentDevelopments,
          competitorLandscape: research.competitorLandscape,
          domainInsights: research.domainInsights,
          journeyStages: research.journeyStages || null,
          industryDimensions: research.industryDimensions?.map(d => ({
            name: d.name,
            description: d.description,
          })) || null,
        }),
        summary: `**Retrieved research context:**\n\n**Company:** ${research.companyOverview}\n\n**Industry:** ${research.industryContext}\n\n**Key Challenges**\n${challengesList}\n\n**Recent Developments**\n${devsList}${research.domainInsights ? `\n\n**Domain Insights:** ${research.domainInsights}` : ''}`,
      };
    }

    case 'get_workshop_context': {
      const bp = context.blueprint;
      return {
        result: JSON.stringify({
          clientName: context.clientName || 'Unknown client',
          industry: context.industry || 'Unknown industry',
          workshopPurpose: context.workshopPurpose || null,
          desiredOutcomes: context.desiredOutcomes || null,
          dreamTrack: context.dreamTrack || null,
          targetDomain: context.targetDomain || null,
          engagementType: context.engagementType || null,
          domainPack: context.domainPack || null,
          actorTaxonomy: bp?.actorTaxonomy?.map(a => ({ label: a.label, description: a.description })) || null,
          blueprintLenses: bp?.lenses?.map(l => ({ name: l.name, description: l.description })) || null,
        }),
        summary: `**Workshop context:**\n\n**Client:** ${context.clientName || 'Unknown'} (${context.industry || 'Unknown industry'})\n**Track:** ${context.dreamTrack || 'Not set'}${context.targetDomain ? ` -- ${context.targetDomain}` : ''}${context.workshopPurpose ? `\n**Purpose:** ${context.workshopPurpose}` : ''}${context.desiredOutcomes ? `\n**Desired Outcomes:** ${context.desiredOutcomes}` : ''}${bp?.actorTaxonomy?.length ? `\n**Audience roles:** ${bp.actorTaxonomy.map(a => a.label).join(', ')}` : ''}`,
      };
    }

    case 'design_lens_questions': {
      const lens = String(args.lens || '');
      const label = String(args.label || lens);
      const questions = args.questions as Array<Record<string, unknown>>;

      if (!lens || !Array.isArray(questions)) {
        return {
          result: JSON.stringify({ error: 'Invalid lens or questions' }),
          summary: 'Invalid lens design request',
        };
      }

      // Build typed Discovery questions
      const typed: DiscoveryQuestion[] = questions.map((q) => {
        const tag = String(q.tag || 'context');
        const validTag = VALID_TAGS.includes(tag as typeof VALID_TAGS[number]) ? tag : 'context';

        const dq: DiscoveryQuestion = {
          id: nanoid(8),
          text: String(q.text || ''),
          tag: validTag,
          purpose: String(q.purpose || ''),
          isEdited: false,
        };

        if (validTag === 'triple_rating' && Array.isArray(q.maturityScale)) {
          dq.maturityScale = (q.maturityScale as unknown[]).map(s => String(s));
        }

        return dq;
      });

      const validationIssues = typed.flatMap((question, index) =>
        validateDiscoveryQuestion(lens, question, { workshopType: context.workshopType }).map((issue) => `Q${index + 1}: ${issue}`),
      );
      if (validationIssues.length > 0) {
        const canonicalLens = canonicalizeLensName(lens);
        const gtmContract = isGoToMarketWorkshopType(context.workshopType) && canonicalLens
          ? getDiscoveryLensContract('GO_TO_MARKET', canonicalLens)
          : null;
        const remediation = gtmContract
          ? `Rewrite the rejected questions for the ${canonicalLens} GTM contract. ${gtmContract.objective} Required evidence: ${gtmContract.evidenceRequirement} Required signals: ${gtmContract.requiredSignals.join(', ')}. Ask about one signal only. Do not copy the gold examples verbatim.`
          : 'Rewrite the rejected questions so exploratory questions start with observable language ' +
            'such as "What happens", "Where do you see", "What makes it difficult", "What works well", ' +
            '"Where does", "What slows", "What helps", "What gets in the way", "Which parts", ' +
            '"Which points", "How often", or "What tends to happen". Keep the wording grounded in lived work and make the lens signal explicit in the question text.';
        return {
          result: JSON.stringify({
            error: 'Questions failed validation',
            lens,
            issues: validationIssues,
            remediation,
          }),
          summary: `**${label} lens rejected**\n${validationIssues.map((issue) => `- ${issue}`).join('\n')}\n- ${remediation}`,
        };
      }

      const lensQuestions: DiscoveryLensQuestions = {
        key: lens,
        label: getDiscoveryLensDisplayLabel(lens),
        questions: typed,
      };

      designedLenses.set(lens, lensQuestions);

      const qLines = typed.map((q, i) => {
        const scaleNote = q.maturityScale ? ` (5-level scale)` : '';
        return `  ${i + 1}. [${q.tag}${scaleNote}] "${q.text}"\n     _Purpose:_ ${q.purpose}`;
      }).join('\n\n');

      return {
        result: JSON.stringify({
          lens,
          questionsStored: typed.length,
          tagDistribution: typed.reduce((acc, q) => {
            acc[q.tag] = (acc[q.tag] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        }),
        summary: `**Designed ${label} lens** -- ${typed.length} Discovery questions\n\n${qLines}`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

export function buildDiscoverySystemPrompt(
  context: PrepContext,
  promptOptions?: { blueprint?: WorkshopBlueprint | null; direction?: string | null },
): string {
  const bp = promptOptions?.blueprint;
  const direction = promptOptions?.direction;

  // Build facilitator direction block (highest priority)
  const directionBlock = direction
    ? `\nFACILITATOR DIRECTION (HIGHEST PRIORITY -- FOLLOW THIS ABOVE ALL ELSE):
${direction}\n`
    : '';

  // Build engagement type block — shapes how questions are designed
  const engagementTypeBlock = (() => {
    if (!context.engagementType) return '';
    const et = getEngagementTypeProfile(context.engagementType);
    return `\n═══ ENGAGEMENT TYPE: ${et.label.toUpperCase()} ═══\n${et.questionPromptModifier}\n`;
  })();

  const workshopTypeBlock = (() => {
    if (!context.workshopType) return '';
    const wt = getWorkshopTypeProfile(context.workshopType);
    return `\n═══ WORKSHOP TYPE: ${wt.label.toUpperCase()} ═══\n${wt.structuralFocus}\n`;
  })();
  const workshopSpecificRulesBlock = buildWorkshopSpecificQuestionDesignRules(context.workshopType);

  // Build universal answerability block from blueprint actor taxonomy
  const actors = bp?.actorTaxonomy;
  const actorBlock = actors?.length
    ? `\nPARTICIPANT CONTEXT:
The following roles may appear in the interviews:
${actors.map(a => `  - ${a.label}: ${a.description}`).join('\n')}

UNIVERSAL ANSWERABILITY RULE:
Every single question must be answerable by any participant in the room:
- agent
- team leader
- manager
- executive

Do NOT tailor separate questions by role.
Do NOT ask what people know or own.
Ask only what people experience, see, work around, repeat, wait for, or find difficult in reality.\n`
    : '';

  return `You are the DREAM Discovery Question Agent. Your job is to generate tailored
Discovery interview questions for ${context.clientName || 'the client'} (${context.industry || 'unknown industry'}).

These questions will be used in one-on-one Discovery interviews with participants
BEFORE the live workshop session. Each interview explores the participant's
perspective through multiple lenses.

${context.workshopPurpose ? `WORKSHOP PURPOSE (WHY WE ARE HERE):\n${context.workshopPurpose}\n` : ''}${context.desiredOutcomes ? `DESIRED OUTCOMES (WHAT WE MUST WALK AWAY WITH):\n${context.desiredOutcomes}\n` : ''}${context.workshopPurpose || context.desiredOutcomes ? `THIS IS THE MOST IMPORTANT INPUT. Every Discovery question you design MUST serve this purpose and drive toward surfacing the insights needed to achieve these outcomes.\n` : ''}${workshopTypeBlock}${engagementTypeBlock}${directionBlock}${actorBlock}${workshopSpecificRulesBlock}
YOUR APPROACH:
1. First, get the domain pack context (tool 1) to see the lenses and question templates.
2. Get the research context (tool 2) to understand the company, industry, and challenges.
3. Get the workshop context (tool 3) for purpose, outcomes, and business context.
4. For EACH lens, call design_lens_questions with 4-5 questions:
   - Question 1 MUST be a maturity rating question with tag "triple_rating" and a
     maturityScale array of exactly 5 levels (from lowest maturity to highest).
     The scale should be specific to the lens and client context, not generic.
     *** THIS QUESTION MUST EXPLICITLY ASK ALL THREE OF THE FOLLOWING ***
     (1) WHERE ARE YOU NOW?     — current maturity today
     (2) WHERE DO YOU WANT TO BE? — target maturity
     (3) WHAT IF NOTHING CHANGES? — projected maturity if no action is taken
     Combine all three into a single question.
     The wording MUST anchor in observable evidence.
     For non-GTM workshops, use wording like:
     "Based on what you see in day-to-day work, where is this today, where should it be, and where will it end up if nothing changes?"
     For GTM workshops, use wording like:
     "Based on recent wins, losses, and live deals, where is this today, where should it be, and where will it end up if nothing changes?"
     NEVER ask only one or two of these. The spider diagram requires all three ratings.
     If you omit target or projected, those values will be fabricated in the report.
   - Questions 2-5 should be exploratory questions with tags from:
     strengths, gaps, friction, future, working, pain_points, support, constraint, context
   - Use the domain pack templates as a STARTING POINT but REFINE them based on:
     * The specific client and industry (reference by name)
     * Research findings (company challenges, market landscape, competitors)
     * Workshop purpose and desired outcomes
     * What any participant can directly observe and describe from day-to-day work
   - Questions should feel tailored to this specific client, not generic
   - Non-GTM exploratory questions MUST begin with an observable starter such as:
     * "What happens..."
     * "Where do you see..."
     * "What makes it difficult..."
     * "What works well..."
     * "Where does..."
     * "What slows..."
     * "What helps..."
     * "What gets in the way..."
     * "Which parts..."
     * "Which points..."
     * "How often..."
     * "What tends to happen..."
   - For GTM workshops, exploratory questions should follow the same behavioural pattern as the gold examples without copying them verbatim and may begin with:
     * "Across recent wins and losses..."
     * "In recent wins..."
     * "In recent losses..."
     * "Across live deals..."
     * "Who do you win with..."
     * "Where does..."
     * "Where have recent deals..."
     * "What are clients actually buying..."
5. After all lenses are designed, call commit_discovery_questions with a rationale.

QUESTION DESIGN PRINCIPLES:
- These are for ONE-ON-ONE interviews, not group sessions.
- Every question must be answerable by any participant from agent to exec.
- Ask about observable work and lived experience only.
- Do NOT ask about ownership, accountability hierarchy, financial performance, strategy quality, or specialist leadership knowledge.
- MANDATORY: The maturity rating question MUST ask current state, target state,
  AND projected state (what if nothing changes) — all three in one question.
  Missing any one of these makes the spider diagram unreliable and forces the
  summary to fabricate answers.
- Exploratory questions should surface specific insights about the client's reality.
- Reference actual industry dynamics, company challenges, and competitor landscape.
- Questions should be open-ended and conversational, not yes/no.
- Avoid jargon unless it is specific to the client's industry.
- If the workshop type is GO-TO-MARKET / Strategy, every lens must still use the same canonical lens set, but the interpretation must be commercial and market-facing rather than internally maturity-led.

QUESTION LENGTH AND WORDING (MANDATORY — HARD LIMITS):
- Exploratory questions (Q2–Q5): MAXIMUM 20 words. No exceptions.
- Maturity question (Q1): MAXIMUM 25 words. Still spoken English. Still one breath.
- One idea per question. If the sentence needs a comma to finish the thought, cut or split it.
- No setup language. Remove: "based on what you see", "in your experience", "thinking about", "when it comes to", "in the context of".
- No explanatory clauses after the question. The question ends at the question mark.
- No repeating the company name unless it is essential for clarity.
- STYLE TEST: Before writing the question, ask: "Would a senior operator say this out loud in one breath?" If no — rewrite it.
- If it sounds like a consultant wrote it for a report, it is wrong. Rewrite it.
- Output the spoken question only. No rationale, labels, or helper text embedded in the question wording.
- For GTM workshops, do not fall back to generic observable-work prompts if they lose the commercial signal. The question must still force deal evidence.
- Do NOT start exploratory questions with:
  "How..."
  "Why..."
  "What is leadership doing..."
  "What strategy..."
  "How effective..."

LENS RULES:
- Operations: ask about flow, bottlenecks, delays, queues, handoffs, and real process friction.
- People: ask about capability, clarity, workload, support, behaviour, and how work feels in practice. Avoid HR abstraction.
- Technology: ask about tools, systems, usability, friction, and failure points people deal with directly.
- Commercial: ask about customer experience, customer pain points, expectations, complaints, and what teams see customers struggling with.
- Partners: ask about external dependencies, cross-team handoffs, third-party accountability, and outsourced delivery interactions.
- Risk/Compliance: ask about rules, approvals, checks, controls, and where they help or slow the work down.

WORKSHOP-TYPE OVERRIDE:
- For GO-TO-MARKET / Strategy workshops, reinterpret every lens through market outcomes:
  * ask how this lens affects win/loss, ICP fit, proposition credibility, delivery against promise, deal speed, renewal/churn, pricing confidence, or buyer value perception
  * do NOT revert to generic internal maturity questions
  * do NOT copy the wording of the gold examples; use current workshop context to produce unique phrasing

MANDATORY GLOBAL LANGUAGE RULES:
- Prefer question openings like:
  "What happens..."
  "Where do you see..."
  "What makes it difficult..."
  "What works well..."
- Do NOT ask:
  "How effective is strategy?"
  "How strong is financial performance?"
  "What is leadership doing about...?"

MATURITY SCALE EXAMPLES:
For a People lens in a Contact Centre:
  Level 1: "People rely on guesswork, feel overloaded, and struggle to get clear support"
  Level 2: "Some support exists, but workload and clarity are inconsistent"
  Level 3: "Most people understand the work, get usable support, and can keep up day to day"
  Level 4: "Teams are capable, clear, and able to handle change with limited friction"
  Level 5: "Work feels well-supported, sustainable, and consistently effective across the operation"

The scale should always be specific to the lens AND the client's domain.

EXAMPLES OF GOOD vs BAD QUESTIONS:

BAD (too long, over-written, consultant prose):
  "Based on what you see in current work today, where is the consistency of how teams articulate value to customers?"
  → Too long. Remove setup. Rewrite: "Where do teams tell different stories to the same customer?"

BAD (too strategic or role-specific):
  "What support do you need from leadership to advance sustainability initiatives?"
  "How effective is the financial performance of this function?"
  "What is leadership doing about margin pressure?"

BAD (generic shell):
  "How would you rate your technology maturity?"
  "What are your biggest people challenges?"
  "How effective is the operating model?"
  "Why is this difficult?"

BAD (over 20 words, multiple ideas, setup language embedded):
  "Based on what you see in day-to-day operations, where do delays, handoff failures, or rework create the most pressure on service quality for customers?"
  → Strip it: "Where do handoffs break down and create pressure on service quality?"

GOOD (observable, universal, spoken, under 20 words):
  "When work slows down, where does it get stuck?"
  "What makes it hardest to do the job well day to day?"
  "Where do customers show the most frustration?"
  "Which tools do people work around most?"
  "Where do you see effort repeated or chased unnecessarily?"
  "How often do approvals hold things up in practice?"
  "Where do teams tell different stories in the same deal?"

The key difference: GOOD questions are short, spoken, reference a real signal,
and are answerable by anyone in the room from lived experience.

When communicating your findings, speak naturally as a colleague would.
Be professional but warm. Explain your reasoning clearly.`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runDiscoveryQuestionAgent(
  workshopId: string,
  onConversationEntry?: (entry: { role: string; content: string }) => void,
  options?: DiscoveryQuestionAgentOptions,
): Promise<DiscoveryQuestionSet> {
  // ── Load workshop data ──────────────────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      workshopType: true,
      clientName: true,
      industry: true,
      companyWebsite: true,
      dreamTrack: true,
      targetDomain: true,
      prepResearch: true,
      domainPack: true,
      domainPackConfig: true,
      engagementType: true,
      businessContext: true,
      description: true,
      blueprint: true,
    },
  });

  if (!workshop) {
    throw new Error(`Workshop ${workshopId} not found`);
  }

  // Load blueprint: prefer passed-in option, fall back to DB
  const decryptedWorkshop = decryptWorkshopContext(workshop);
  const blueprint = options?.blueprint ?? readBlueprintFromJson(decryptedWorkshop.blueprint);

  // Build PrepContext from workshop data
  const context: PrepContext = {
    workshopId,
    workshopType: blueprint?.workshopType ?? decryptedWorkshop.workshopType ?? null,
    workshopPurpose: decryptedWorkshop.description || null,
    desiredOutcomes: decryptedWorkshop.businessContext || null,
    clientName: decryptedWorkshop.clientName || null,
    industry: decryptedWorkshop.industry || null,
    companyWebsite: decryptedWorkshop.companyWebsite || null,
    dreamTrack: decryptedWorkshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
    targetDomain: decryptedWorkshop.targetDomain || null,
    engagementType: decryptedWorkshop.engagementType || null,
    domainPack: decryptedWorkshop.domainPack || null,
    domainPackConfig: decryptedWorkshop.domainPackConfig as Record<string, unknown> | null,
    blueprint,
  };

  const research = decryptedWorkshop.prepResearch as WorkshopPrepResearch | null;
  assertWorkshopContextIntegrity({
    clientName: decryptedWorkshop.clientName,
    industry: decryptedWorkshop.industry,
    desiredOutcomes: decryptedWorkshop.businessContext,
    prepResearch: research,
    blueprint,
  });

  const domainPack = resolveIndustryPack(decryptedWorkshop.industry, decryptedWorkshop.engagementType, decryptedWorkshop.dreamTrack)
    ?? (decryptedWorkshop.domainPack ? getDomainPack(decryptedWorkshop.domainPack) : null);

  // Wrap callback to match AgentConversationCallback style
  const emitConversation = (message: string, type: string = 'info') => {
    onConversationEntry?.({ role: type, content: message });
  };

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildDiscoverySystemPrompt(context, {
    blueprint,
    direction: options?.direction,
  });
  const startMs = Date.now();

  // Track designed lenses as they come in
  const designedLenses = new Map<string, DiscoveryLensQuestions>();

  // Determine lenses: blueprint (curated) > domain pack — no generic fallback
  const blueprintLensNames = blueprint?.lenses?.length
    ? blueprint.lenses.map(l => l.name) : null;
  const domainPackLensNames = domainPack?.lenses ?? null;
  const lensNames: string[] | null = blueprintLensNames ?? domainPackLensNames;
  if (!lensNames?.length) {
    throw new Error(
      'Workshop lens set is required for discovery questions — no fallback to generic defaults. ' +
      'Ensure blueprint.lenses or a domain pack is configured in prep.',
    );
  }
  const lensSource: LensSource = blueprintLensNames
    ? 'blueprint' : 'domain_pack';
  const lensListStr = lensNames.join(', ');

  if (isGoToMarketWorkshopType(context.workshopType)) {
    const rationale = 'Discovery questions were generated from the GTM workshop contract using the current workshop context, desired outcomes, and company-specific commercial signals. Gold examples were used for behavioural calibration only, not copied as output.';
    const questionSet = sanitizeDiscoveryQuestionSet(
      buildContextualGtmDiscoveryQuestionSet(lensNames, context, research, rationale, options?.direction),
      blueprint,
    );
    if (!questionSet) {
      throw new Error('Contextual GTM discovery question set sanitization failed.');
    }
    const validationError = validateDiscoveryQuestionSet(questionSet, { workshopType: context.workshopType });
    if (validationError) {
      throw new Error(`Contextual GTM discovery question set failed validation: ${validationError}`);
    }
    await storeDiscoveryQuestions(workshopId, questionSet);
    emitConversation(
      `Built ${questionSet.lenses.reduce((sum, lens) => sum + lens.questions.length, 0)} contextual GTM discovery questions across ${questionSet.lenses.length} lenses from the workshop contract, research context, and desired outcomes.`,
      'proposal',
    );
    return questionSet;
  }

  if (isTransformationWorkshopType(context.workshopType)) {
    const rationale = 'Discovery questions were generated from the Transformation workshop contract using the current workshop context, desired outcomes, and company-specific change signals. The questions were built from future-state intent, dependency risk, and transformation blockers rather than generic maturity templates.';
    const questionSet = sanitizeDiscoveryQuestionSet(
      buildContextualTransformationDiscoveryQuestionSet(lensNames, context, research, rationale, options?.direction),
      blueprint,
    );
    if (!questionSet) {
      throw new Error('Contextual Transformation discovery question set sanitization failed.');
    }
    const validationError = validateDiscoveryQuestionSet(questionSet, { workshopType: context.workshopType });
    if (validationError) {
      throw new Error(`Contextual Transformation discovery question set failed validation: ${validationError}`);
    }
    await storeDiscoveryQuestions(workshopId, questionSet);
    emitConversation(
      `Built ${questionSet.lenses.reduce((sum, lens) => sum + lens.questions.length, 0)} contextual Transformation discovery questions across ${questionSet.lenses.length} lenses from the workshop contract, research context, and desired outcomes.`,
      'proposal',
    );
    return questionSet;
  }

  if (isOperationsWorkshopType(context.workshopType)) {
    const rationale = 'Discovery questions were generated from the Operations workshop contract using the current workshop context, desired outcomes, and company-specific execution signals. The questions were built from flow, bottlenecks, handoffs, controls, and service consequences rather than generic maturity templates.';
    const questionSet = sanitizeDiscoveryQuestionSet(
      buildContextualOperationsDiscoveryQuestionSet(lensNames, context, research, rationale, options?.direction),
      blueprint,
    );
    if (!questionSet) {
      throw new Error('Contextual Operations discovery question set sanitization failed.');
    }
    const validationError = validateDiscoveryQuestionSet(questionSet, { workshopType: context.workshopType });
    if (validationError) {
      throw new Error(`Contextual Operations discovery question set failed validation: ${validationError}`);
    }
    await storeDiscoveryQuestions(workshopId, questionSet);
    emitConversation(
      `Built ${questionSet.lenses.reduce((sum, lens) => sum + lens.questions.length, 0)} contextual Operations discovery questions across ${questionSet.lenses.length} lenses from the workshop contract, research context, and desired outcomes.`,
      'proposal',
    );
    return questionSet;
  }

  if (isAiWorkshopType(context.workshopType)) {
    const rationale = 'Discovery questions were generated from the AI workshop contract using the current workshop context, desired outcomes, and company-specific AI readiness and implementation signals. The questions were built from workflow fit, data and tooling readiness, governance constraints, and adoption risk rather than generic technology maturity templates.';
    const questionSet = sanitizeDiscoveryQuestionSet(
      buildContextualAiDiscoveryQuestionSet(lensNames, context, research, rationale, options?.direction),
      blueprint,
    );
    if (!questionSet) {
      throw new Error('Contextual AI discovery question set sanitization failed.');
    }
    const validationError = validateDiscoveryQuestionSet(questionSet, { workshopType: context.workshopType });
    if (validationError) {
      throw new Error(`Contextual AI discovery question set failed validation: ${validationError}`);
    }
    await storeDiscoveryQuestions(workshopId, questionSet);
    emitConversation(
      `Built ${questionSet.lenses.reduce((sum, lens) => sum + lens.questions.length, 0)} contextual AI discovery questions across ${questionSet.lenses.length} lenses from the workshop contract, research context, and desired outcomes.`,
      'proposal',
    );
    return questionSet;
  }

  if (isFinanceWorkshopType(context.workshopType)) {
    const rationale = 'Discovery questions were generated from the Finance workshop contract using the current workshop context, desired outcomes, and company-specific value leakage signals. The questions were built from effort-to-value conversion, cost-to-serve, weak-fit work, control drag, and avoidable waste rather than generic finance or maturity templates.';
    const questionSet = sanitizeDiscoveryQuestionSet(
      buildContextualFinanceDiscoveryQuestionSet(lensNames, context, research, rationale, options?.direction),
      blueprint,
    );
    if (!questionSet) {
      throw new Error('Contextual Finance discovery question set sanitization failed.');
    }
    const validationError = validateDiscoveryQuestionSet(questionSet, { workshopType: context.workshopType });
    if (validationError) {
      throw new Error(`Contextual Finance discovery question set failed validation: ${validationError}`);
    }
    await storeDiscoveryQuestions(workshopId, questionSet);
    emitConversation(
      `Built ${questionSet.lenses.reduce((sum, lens) => sum + lens.questions.length, 0)} contextual Finance discovery questions across ${questionSet.lenses.length} lenses from the workshop contract, research context, and desired outcomes.`,
      'proposal',
    );
    return questionSet;
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured -- cannot run Discovery Question Agent');
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Please design tailored Discovery interview questions for ${context.clientName || 'this client'}. The lenses to cover are: ${lensListStr}. Start by reviewing the domain pack templates, research context, and workshop context, then design 4-5 questions per lens.`,
    },
  ];

  // Track the commit rationale for extraction
  let commitRationale = '';

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) {
        console.log(`[Discovery Question Agent] Timeout after ${iteration} iterations`);
        break;
      }

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'commit_discovery_questions' } }
        : 'auto';

      console.log(`[Discovery Question Agent] Iteration ${iteration}${isLastIteration ? ' (forced commit)' : ''}`);

      const completion = await openAiBreaker.execute(() => openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        messages,
        tools: DISCOVERY_QUESTION_TOOLS,
        tool_choice: toolChoice,
        parallel_tool_calls: true,
      }));

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      // Emit thinking/commentary
      if (assistantMessage.content) {
        const thinking = assistantMessage.content.trim();
        if (thinking.length > 20) {
          emitConversation(thinking, 'info');
        }
      }

      // No tool calls -- done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }

      // Process tool calls
      let committed = false;

      for (const toolCall of assistantMessage.tool_calls as any[]) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;

        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        if (fnName === 'commit_discovery_questions') {
          committed = true;
          commitRationale = String(fnArgs.rationale || '');

          // Build summary of all designed lenses
          const lensSummary: string[] = [];
          let totalQuestions = 0;
          for (const [, lensData] of designedLenses.entries()) {
            totalQuestions += lensData.questions.length;
            lensSummary.push(`**${lensData.label}:** ${lensData.questions.length} questions`);
            for (const q of lensData.questions) {
              const scaleNote = q.maturityScale ? ' (maturity scale)' : '';
              lensSummary.push(`  - [${q.tag}${scaleNote}] "${q.text}"`);
            }
          }

          emitConversation(
            `I've completed the Discovery question set. **${totalQuestions} questions** across ${designedLenses.size} lenses (lensSource: ${lensSource}).\n\n**Strategy**\n${commitRationale}\n\n**Questions by Lens**\n${lensSummary.join('\n')}`,
            'proposal',
          );

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed' }),
          });
        } else {
          const toolResult = executeDiscoveryTool(
            fnName, fnArgs, context, research, domainPack, designedLenses,
          );

          // Emit conversation entries for tool results
          if (fnName === 'design_lens_questions') {
            emitConversation(toolResult.summary, 'request');
          } else if (fnName === 'get_domain_pack_context' || fnName === 'get_research_context' || fnName === 'get_workshop_context') {
            emitConversation(toolResult.summary, 'request');
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult.result,
          });

          console.log(`[Discovery Question Agent] Tool ${fnName}: ${toolResult.summary.substring(0, 120)}`);
        }
      }

      if (committed) {
        const elapsed = Date.now() - startMs;
        console.log(`[Discovery Question Agent] Committed after ${iteration + 1} iterations, ${elapsed}ms`);

        if (designedLenses.size !== lensNames.length) {
          throw new Error(
            `Discovery question set is incomplete: expected ${lensNames.length} lenses but only ${designedLenses.size} passed validation.`,
          );
        }

        const questionSet = sanitizeDiscoveryQuestionSet(
          buildDiscoveryQuestionSet(designedLenses, commitRationale, options?.direction),
          blueprint,
        );
        if (!questionSet) {
          throw new Error('Discovery question set sanitization failed.');
        }
        const validationError = validateDiscoveryQuestionSet(questionSet, { workshopType: context.workshopType });
        if (validationError) {
          throw new Error(validationError);
        }

        // Store result on the workshop
        await storeDiscoveryQuestions(workshopId, questionSet);

        return questionSet;
      }
    }

    // Loop ended without commit -- build from whatever lenses were designed
    console.log('[Discovery Question Agent] Loop ended without commit -- building from designed lenses');
    if (designedLenses.size !== lensNames.length) {
      throw new Error(
        `Discovery question set is incomplete: expected ${lensNames.length} lenses but only ${designedLenses.size} passed validation.`,
      );
    }

    const questionSet = sanitizeDiscoveryQuestionSet(
      buildDiscoveryQuestionSet(
        designedLenses,
        'Discovery interview questions designed based on domain pack and company context.',
        options?.direction,
      ),
      blueprint,
    );
    if (!questionSet) {
      throw new Error('Discovery question set sanitization failed.');
    }
    const validationError = validateDiscoveryQuestionSet(questionSet, { workshopType: context.workshopType });
    if (validationError) {
      throw new Error(validationError);
    }

    await storeDiscoveryQuestions(workshopId, questionSet);

    return questionSet;
  } catch (error) {
    console.error('[Discovery Question Agent] Failed:', error instanceof Error ? error.message : error);
    emitConversation(
      `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Stopping generation because generic fallback questions are disabled for context integrity.`,
      'info',
    );
    throw error;
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function buildDiscoveryQuestionSet(
  designedLenses: Map<string, DiscoveryLensQuestions>,
  rationale: string,
  direction?: string | null,
): DiscoveryQuestionSet {
  const lenses: DiscoveryLensQuestions[] = [];

  for (const [, lensData] of designedLenses.entries()) {
    lenses.push(lensData);
  }

  return {
    lenses,
    generatedAtMs: Date.now(),
    agentRationale: rationale,
    facilitatorDirection: direction || null,
  };
}

/**
 * Store the Discovery question set on the workshop's dedicated discoveryQuestions field.
 */
async function storeDiscoveryQuestions(
  workshopId: string,
  questionSet: DiscoveryQuestionSet,
): Promise<void> {
  try {
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { blueprint: true },
    });
    const blueprint = readBlueprintFromJson(workshop?.blueprint);
    const sanitizedQuestionSet = sanitizeDiscoveryQuestionSet(questionSet, blueprint);
    if (!sanitizedQuestionSet) {
      throw new Error('Discovery question set sanitization failed before persistence.');
    }

    await prisma.workshop.update({
      where: { id: workshopId },
      data: {
        discoveryQuestions: JSON.parse(JSON.stringify(sanitizedQuestionSet)) as any,
      },
    });

    console.log(`[Discovery Question Agent] Stored ${sanitizedQuestionSet.lenses.length} lenses of questions for workshop ${workshopId}`);
  } catch (err) {
    console.error('[Discovery Question Agent] Failed to store questions:', err instanceof Error ? err.message : err);
    throw err;
  }
}

function getDiscoveryLensDisplayLabel(lens: string): string {
  return lens;
}

function getDiscoveryLensPromptLabel(lens: string): string {
  const canonicalLens = canonicalizeLensName(lens);
  switch (canonicalLens) {
    case 'Commercial':
      return 'customer experience';
    default:
      return lens.toLowerCase();
  }
}

function interpolateGtmScaleLevels(level1: string, level3: string, level5: string): string[] {
  return [
    level1,
    `Some stronger signals exist, but they are inconsistent and not yet reliable enough to shape commercial outcomes with confidence.`,
    level3,
    `Strong practices are visible across many deals and segments, but they are not yet fully consistent or scalable.`,
    level5,
  ];
}

type GtmDiscoverySignal =
  | 'ICP'
  | 'anti_ICP'
  | 'win_pattern'
  | 'loss_pattern'
  | 'constraint'
  | 'misalignment'
  | 'differentiation'
  | 'fragility';

type GtmContextProfile = {
  company: string;
  industry: string;
  dealScope: string;
  propositionFocus: string;
  targetFocus: string;
  targetReference: string;
  outcomeFocus: string;
  competitorFocus: string;
  partnerFocus: string;
  riskFocus: string;
  outcomePrompt: string;
};

type GtmQuestionPlan = {
  signal: GtmDiscoverySignal;
  tag: DiscoveryQuestion['tag'];
  purpose: string;
  buildQuestion: (profile: GtmContextProfile) => string;
};

type GtmLensPlan = {
  tripleSignal: GtmDiscoverySignal;
  tripleFocus: string;
  exploratory: GtmQuestionPlan[];
};

type TransformationDiscoverySignal =
  | 'change_readiness'
  | 'credibility_gap'
  | 'behavioural_friction'
  | 'capability_gap'
  | 'fatigue_risk'
  | 'operating_model_gap'
  | 'handoff_friction'
  | 'decision_delay'
  | 'execution_dependency'
  | 'scaling_blocker'
  | 'architecture_constraint'
  | 'data_gap'
  | 'integration_dependency'
  | 'technology_enabler'
  | 'change_complexity'
  | 'market_pressure'
  | 'promise_gap'
  | 'customer_expectation_risk'
  | 'growth_dependency'
  | 'commercial_tradeoff'
  | 'journey_breakdown'
  | 'trust_gap'
  | 'customer_effort'
  | 'service_failure'
  | 'experience_expectation_gap'
  | 'approval_friction'
  | 'governance_drag'
  | 'control_dependency'
  | 'risk_constraint'
  | 'assurance_requirement'
  | 'external_dependency'
  | 'partner_constraint'
  | 'delivery_risk'
  | 'alignment_gap'
  | 'acceleration_opportunity';

type TransformationContextProfile = {
  company: string;
  industry: string;
  futureStateFocus: string;
  changeOutcome: string;
  operatingAnchor: string;
  technologyAnchor: string;
  marketAnchor: string;
  governanceAnchor: string;
  partnerAnchor: string;
};

type TransformationQuestionPlan = {
  signal: TransformationDiscoverySignal;
  tag: DiscoveryQuestion['tag'];
  purpose: string;
  buildQuestion: (profile: TransformationContextProfile) => string;
};

type TransformationLensPlan = {
  tripleSignal: TransformationDiscoverySignal;
  tripleFocus: string;
  exploratory: TransformationQuestionPlan[];
};

type OperationsDiscoverySignal =
  | 'clarity_gap'
  | 'capacity_pressure'
  | 'capability_gap'
  | 'handoff_behaviour'
  | 'support_strength'
  | 'bottleneck'
  | 'handoff_friction'
  | 'rework'
  | 'decision_delay'
  | 'flow_reliability'
  | 'tool_friction'
  | 'system_failure'
  | 'data_gap'
  | 'workaround_dependency'
  | 'automation_support'
  | 'service_pain'
  | 'expectation_gap'
  | 'value_breakdown'
  | 'customer_delay'
  | 'confidence_signal'
  | 'approval_delay'
  | 'control_friction'
  | 'policy_ambiguity'
  | 'compliance_breakdown'
  | 'assurance_strength'
  | 'dependency_delay'
  | 'partner_handoff_gap'
  | 'responsiveness_issue'
  | 'accountability_gap'
  | 'partner_support';

type OperationsContextProfile = {
  company: string;
  industry: string;
  operationalFocus: string;
  serviceFlowFocus: string;
  customerImpactFocus: string;
  technologyFocus: string;
  controlFocus: string;
  partnerFocus: string;
};

type OperationsQuestionPlan = {
  signal: OperationsDiscoverySignal;
  tag: DiscoveryQuestion['tag'];
  purpose: string;
  buildQuestion: (profile: OperationsContextProfile) => string;
};

type OperationsLensPlan = {
  tripleSignal: OperationsDiscoverySignal;
  tripleFocus: string;
  exploratory: OperationsQuestionPlan[];
};

type AiDiscoverySignal =
  | 'adoption_readiness'
  | 'trust_gap'
  | 'capability_gap'
  | 'role_anxiety'
  | 'change_support'
  | 'automation_fit'
  | 'workflow_breakpoint'
  | 'repeat_work'
  | 'exception_complexity'
  | 'handoff_dependency'
  | 'data_readiness'
  | 'integration_constraint'
  | 'tooling_gap'
  | 'platform_fit'
  | 'technical_risk'
  | 'customer_value_opportunity'
  | 'promise_risk'
  | 'service_gain'
  | 'trust_risk'
  | 'differentiation_opportunity'
  | 'governance_requirement'
  | 'approval_barrier'
  | 'compliance_constraint'
  | 'assurance_need'
  | 'risk_exposure'
  | 'vendor_dependency'
  | 'platform_dependency'
  | 'external_data_risk'
  | 'partner_constraint'
  | 'partner_enablement';

type AiContextProfile = {
  company: string;
  industry: string;
  aiFocus: string;
  workflowFocus: string;
  technologyFocus: string;
  customerValueFocus: string;
  governanceFocus: string;
  partnerFocus: string;
};

type AiQuestionPlan = {
  signal: AiDiscoverySignal;
  tag: DiscoveryQuestion['tag'];
  purpose: string;
  buildQuestion: (profile: AiContextProfile) => string;
};

type AiLensPlan = {
  tripleSignal: AiDiscoverySignal;
  tripleFocus: string;
  exploratory: AiQuestionPlan[];
};

type FinanceDiscoverySignal =
  | 'decision_quality'
  | 'ownership_gap'
  | 'capability_gap'
  | 'incentive_misalignment'
  | 'cost_awareness'
  | 'rework_cost'
  | 'delay_cost'
  | 'complexity_drag'
  | 'flow_waste'
  | 'throughput_value'
  | 'manual_effort'
  | 'tooling_waste'
  | 'data_rework'
  | 'automation_gap'
  | 'system_cost_drag'
  | 'weak_fit_work'
  | 'promise_overstretch'
  | 'value_mismatch'
  | 'pricing_pressure'
  | 'commercial_drag'
  | 'retention_value'
  | 'churn_cost'
  | 'service_expectation_gap'
  | 'experience_loyalty'
  | 'customer_effort_cost'
  | 'approval_cost'
  | 'control_drag'
  | 'compliance_overhead'
  | 'assurance_value'
  | 'governance_delay'
  | 'supplier_cost_drag'
  | 'dependency_overhead'
  | 'partner_value_gap'
  | 'outsource_efficiency'
  | 'external_rework';

type FinanceContextProfile = {
  company: string;
  industry: string;
  valueFocus: string;
  operatingValueFocus: string;
  technologyValueFocus: string;
  commercialValueFocus: string;
  controlValueFocus: string;
  partnerValueFocus: string;
};

type FinanceQuestionPlan = {
  signal: FinanceDiscoverySignal;
  tag: DiscoveryQuestion['tag'];
  purpose: string;
  buildQuestion: (profile: FinanceContextProfile) => string;
};

type FinanceLensPlan = {
  tripleSignal: FinanceDiscoverySignal;
  tripleFocus: string;
  exploratory: FinanceQuestionPlan[];
};

function buildGtmContextAnchor(context: PrepContext): string {
  const company = context.clientName?.trim();
  const industry = context.industry?.trim();
  if (company && industry) return `${company}'s ${industry} deals`;
  if (company) return `${company}'s live deals`;
  if (industry) return `${industry} deals`;
  return 'live deals';
}

function buildGtmOfferAnchor(context: PrepContext): string {
  const company = context.clientName?.trim();
  const industry = context.industry?.trim();
  if (company && industry) return `${company}'s ${industry} proposition`;
  if (company) return `${company}'s proposition`;
  if (industry) return `the ${industry} proposition`;
  return 'the proposition';
}

type GtmResearchAnchors = {
  offerFocus: string;
  dealFocus: string;
  segmentFocus: string;
  competitorFocus: string;
  partnerFocus: string;
  riskFocus: string;
};

function buildGtmRiskFocus(industry: string, normalizedResearch: string): string {
  const ind = industry.toLowerCase();
  // Public sector always takes priority regardless of client industry
  if (/public sector|government|civil service|local authority/i.test(industry) || /public sector procurement|government procurement/.test(normalizedResearch)) {
    return 'public-sector procurement, government security, and compliance requirements';
  }
  if (/financial services|banking|insurance|investment|asset management/i.test(ind)) {
    return 'FCA, PRA, and financial conduct compliance requirements';
  }
  if (/healthcare|pharma|life sciences|medical|nhs/i.test(ind)) {
    return 'MHRA, NHS procurement, and clinical compliance requirements';
  }
  if (/energy|utilities|oil|gas|power|water/i.test(ind)) {
    return 'Ofgem, energy regulation, and environmental compliance requirements';
  }
  if (/retail|consumer|fmcg/i.test(ind)) {
    return 'consumer protection, data privacy, and supply chain compliance requirements';
  }
  if (/technology|software|saas|tech/i.test(ind)) {
    return 'software procurement, data residency, and AI governance requirements';
  }
  if (/media|entertainment|broadcast|publishing/i.test(ind)) {
    return 'Ofcom, data privacy, and content licensing compliance requirements';
  }
  if (/transport|logistics|supply chain|freight/i.test(ind)) {
    return 'transport regulation, safety compliance, and procurement requirements';
  }
  if (/professional services|consulting|advisory|legal/i.test(ind)) {
    return 'professional indemnity, data protection, and procurement compliance requirements';
  }
  // Fallback: generic but not public-sector-biased
  return 'risk, procurement, and regulatory compliance requirements';
}

function buildGtmResearchAnchors(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): GtmResearchAnchors {
  const company = context.clientName || 'the business';
  const joined = [
    research?.companyOverview,
    research?.industryContext,
    research?.keyFacilitatorInsight,
    research?.workshopBrief,
    ...(research?.keyPublicChallenges ?? []),
    ...(research?.strategicTensions ?? []),
    ...(research?.workshopHypotheses ?? []),
  ].filter(Boolean).join(' ');
  const normalized = joined.toLowerCase();

  return {
    offerFocus: /ai-led bpo|ai led bpo/.test(normalized)
      ? `${company}'s AI-led BPO proposition`
      : /embedded payments|payments infrastructure/.test(normalized)
        ? `${company}'s embedded payments proposition`
        : buildGtmOfferAnchor(context),
    dealFocus: /contact centre|contact center/.test(normalized)
      ? `${company}'s Contact Centre and BPO deals`
      : /embedded payments|payments infrastructure/.test(normalized)
        ? `${company}'s embedded payments deals`
        : buildGtmContextAnchor(context),
    segmentFocus: /public sector|pensions/.test(normalized) ? 'public sector and pensions opportunities' : `${company}'s highest-fit opportunities`,
    competitorFocus: /teleperformance|concentrix|genpact/.test(normalized) ? 'global BPO competitors such as Teleperformance, Concentrix, and Genpact' : 'credible competitors in live deals',
    partnerFocus: /salesforce|snowflake/.test(normalized) ? 'partnerships such as Salesforce and Snowflake' : 'key delivery and technology partners',
    riskFocus: buildGtmRiskFocus(context.industry ?? '', normalized),
  };
}

function splitCommercialPhrases(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[\n.;•,]|(?:--|\u2014|\u2013)/)
    .map((part) => part.trim())
    // Strip markdown bold/italic markers and heading hashes before any other processing
    .map((part) => part.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim())
    .map((part) => part.replace(/\s+/g, ' '))
    .filter((part) => part.length >= 12 && part.length <= 100)
    .filter((part) => !/^(and|or|but|the|to|in|of|for|a|an)\s+/i.test(part))
    // Exclude label-only lines such as "Purpose:", "**Purpose:**", "Desired outcomes:"
    .filter((part) => !/^(purpose|desired outcomes?|outcomes?)\s*[:]?/i.test(part))
    .filter((part) => /[a-z]/i.test(part));
}

function pickContextPhrase(
  phrases: string[],
  pattern: RegExp,
  fallback: string,
  maxWords = 6,
): string {
  const match = phrases.find((phrase) => {
    if (!pattern.test(phrase.toLowerCase())) return false;
    return phrase.trim().split(/\s+/).length <= maxWords;
  });
  return match ?? fallback;
}

function cleanOutcomePrompt(input: string): string {
  return input
    .replace(/^[a-z ]+:\s*/i, '')
    .replace(/\.$/, '')
    .trim();
}

function buildTargetReference(company: string, targetFocus: string): string {
  const normalized = cleanOutcomePrompt(targetFocus);
  const lower = normalized.toLowerCase();

  if (/\bideal customer profile\b|\bicp\b|\bpriority segments?\b/.test(lower)) {
    return `${company}'s priority ICP segments`;
  }
  if (/\bpublic sector\b/.test(lower) && /\bpensions?\b/.test(lower)) {
    return 'public sector and pensions opportunities';
  }
  if (/\bsegment|segments|buyer|buyers|client|clients|market|opportunit/.test(lower)) {
    return normalized.charAt(0).toLowerCase() + normalized.slice(1);
  }

  return `${company}'s target opportunities`;
}

function buildGtmContextProfile(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): GtmContextProfile {
  const anchors = buildGtmResearchAnchors(context, research);
  const company = context.clientName?.trim() || 'the business';
  const industry = context.industry?.trim() || 'the active market';
  const contextPhrases = [
    ...splitCommercialPhrases(context.workshopPurpose),
    ...splitCommercialPhrases(context.desiredOutcomes),
    ...splitCommercialPhrases(research?.workshopBrief),
    ...splitCommercialPhrases(research?.keyFacilitatorInsight),
    ...splitCommercialPhrases(research?.workshopHypotheses?.join('. ')),
    ...splitCommercialPhrases(research?.strategicTensions?.join('. ')),
  ];

  const targetFocus = pickContextPhrase(
    contextPhrases,
    /\b(icp|segment|target|buyer|market|position|differentiat|value proposition|proposition|who to win|who to target)\b/i,
    anchors.segmentFocus,
  );
  const outcomeFocus = pickContextPhrase(
    contextPhrases,
    /\b(convert|conversion|win|growth|position|package|sell|delivery|differentiat|opportunit|credib|fit|avoid)\b/i,
    `${company}'s ability to win the right work`,
  );
  // Strip leading gerund so "to support ${outcomePrompt}" never doubles to "to support supporting X"
  const outcomePrompt = cleanOutcomePrompt(outcomeFocus)
    .replace(/^(supporting|growing|improving|enabling|strengthening|delivering|building|achieving|winning|driving|generating|capturing)\s+/i, '')
    .trim() || `${company}'s ability to win the right work`;

  return {
    company,
    industry,
    dealScope: anchors.dealFocus,
    propositionFocus: anchors.offerFocus,
    targetFocus,
    targetReference: buildTargetReference(company, targetFocus),
    outcomeFocus,
    competitorFocus: anchors.competitorFocus,
    partnerFocus: anchors.partnerFocus,
    riskFocus: anchors.riskFocus,
    outcomePrompt,
  };
}

function buildTransformationContextAnchor(context: PrepContext): string {
  const company = context.clientName?.trim();
  const industry = context.industry?.trim();
  if (company && industry) return `${company}'s ${industry} operating model`;
  if (company) return `${company}'s current operating model`;
  if (industry) return `${industry} operating reality`;
  return 'the current operating model';
}

function buildTransformationContextProfile(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): TransformationContextProfile {
  const company = context.clientName?.trim() || 'the business';
  const industry = context.industry?.trim() || 'the current market';
  const phrases = [
    ...splitCommercialPhrases(context.workshopPurpose),
    ...splitCommercialPhrases(context.desiredOutcomes),
    ...splitCommercialPhrases(research?.workshopBrief),
    ...splitCommercialPhrases(research?.keyFacilitatorInsight),
    ...splitCommercialPhrases(research?.strategicTensions?.join('. ')),
    ...splitCommercialPhrases(research?.workshopHypotheses?.join('. ')),
  ];

  const rawFutureStateFocus = pickContextPhrase(
    phrases,
    /\b(future state|target state|operating model|transformation|redesign|change|roadmap)\b/i,
    `${company}'s future-state operating model`,
  );
  const futureStateFocus = (() => {
    const cleaned = cleanOutcomePrompt(rawFutureStateFocus);
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
    // Imperative task descriptions (Define X, Redesign X) are directives, not context anchors
    if (/^(define|redesign|build|create|develop|establish|align|reduce|identify|implement|assess|map|enable|surface)\b/i.test(cleaned)) {
      return `${company}'s future-state operating model`;
    }
    // Company-as-subject statements (e.g. "HSBC is investing in digital transformation") are
    // descriptions of current activity, not target-state anchors — use fallback to avoid
    // producing grammatically broken question strings when the phrase is interpolated.
    if (new RegExp(`^${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(is|was|has|are|will|would|can|could)\\b`, 'i').test(cleaned)) {
      return `${company}'s future-state operating model`;
    }
    // Present-state descriptions (e.g. "£8bn programme is underway", "system is live") are
    // current-state statements that break question grammar when used as target-state anchors.
    if (/\b(is underway|are underway|is live|is in place|is ongoing|is happening|has begun|has started)\b/i.test(cleaned)) {
      return `${company}'s future-state operating model`;
    }
    if (/\bfuture state\b|\btarget state\b/i.test(cleaned)) return cleaned;
    if (/\boperating model\b/i.test(cleaned)) return `${company}'s future-state operating model`;
    if (wordCount > 8) return `${company}'s future-state operating model`;
    return cleaned;
  })();
  const changeOutcome = cleanOutcomePrompt(pickContextPhrase(
    phrases,
    /\b(roadmap|future state|change|transformation|target state|operating model|sequenc|blocker|dependency|credible)\b/i,
    `make ${futureStateFocus} credible in practice`,
  ));

  const joined = [
    research?.companyOverview,
    research?.industryContext,
    research?.keyFacilitatorInsight,
    research?.workshopBrief,
    ...(research?.keyPublicChallenges ?? []),
    ...(research?.strategicTensions ?? []),
  ].filter(Boolean).join(' ').toLowerCase();

  return {
    company,
    industry,
    futureStateFocus,
    changeOutcome,
    operatingAnchor: /service|delivery|handoff|workflow|process/.test(joined)
      ? `${company}'s current delivery and handoff model`
      : buildTransformationContextAnchor(context),
    technologyAnchor: /platform|data|integration|system|technology/.test(joined)
      ? `${company}'s current platforms, data, and integration landscape`
      : `${company}'s current technology landscape`,
    marketAnchor: /customer|buyer|client|market|growth/.test(joined)
      ? `${company}'s market promises and customer expectations`
      : `${company}'s commercial commitments`,
    governanceAnchor: /approval|governance|risk|control|compliance|procurement/.test(joined)
      ? `${company}'s approvals, governance, and control model`
      : `${company}'s governance and approval model`,
    partnerAnchor: /partner|vendor|supplier|outsourc|third/.test(joined)
      ? `${company}'s partner and vendor dependencies`
      : `${company}'s external dependencies`,
  };
}

function buildOperationsContextProfile(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): OperationsContextProfile {
  const company = context.clientName?.trim() || 'the operation';
  const industry = context.industry?.trim() || 'the current operation';
  const phrases = [
    ...splitCommercialPhrases(context.workshopPurpose),
    ...splitCommercialPhrases(context.desiredOutcomes),
    ...splitCommercialPhrases(research?.workshopBrief),
    ...splitCommercialPhrases(research?.keyFacilitatorInsight),
    ...splitCommercialPhrases(research?.strategicTensions?.join('. ')),
  ];
  const operationalFocus = pickContextPhrase(
    phrases,
    /\b(service|operation|delivery|execution|handoff|workflow|process|queue|customer)\b/i,
    `${company}'s day-to-day operation`,
  );
  const joined = [
    research?.companyOverview,
    research?.industryContext,
    research?.keyPublicChallenges,
    research?.strategicTensions,
  ].flat().filter(Boolean).join(' ').toLowerCase();

  return {
    company,
    industry,
    operationalFocus,
    serviceFlowFocus: /contact centre|contact center|service|workflow|handoff/.test(joined)
      ? `${company}'s live service flow and handoffs`
      : `${company}'s execution flow`,
    customerImpactFocus: /customer|client|sla|service quality|complaint/.test(joined)
      ? `${company}'s customer and service experience`
      : `${company}'s service outcomes`,
    technologyFocus: /system|platform|tool|data|automation|technology/.test(joined)
      ? `${company}'s systems, tools, and data`
      : `${company}'s operational technology`,
    controlFocus: /approval|control|policy|risk|compliance|audit/.test(joined)
      ? `${company}'s approvals, controls, and policy requirements`
      : `${company}'s compliance and control steps`,
    partnerFocus: /vendor|supplier|partner|outsourc|third/.test(joined)
      ? `${company}'s partner and supplier dependencies`
      : `${company}'s external dependencies`,
  };
}

function buildAiContextProfile(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): AiContextProfile {
  const company = context.clientName?.trim() || 'the business';
  const industry = context.industry?.trim() || 'the current operation';
  const phrases = [
    ...splitCommercialPhrases(context.workshopPurpose),
    ...splitCommercialPhrases(context.desiredOutcomes),
    ...splitCommercialPhrases(research?.workshopBrief),
    ...splitCommercialPhrases(research?.keyFacilitatorInsight),
    ...splitCommercialPhrases(research?.strategicTensions?.join('. ')),
    ...splitCommercialPhrases(research?.workshopHypotheses?.join('. ')),
  ];
  const aiFocus = pickContextPhrase(
    phrases,
    /\b(ai|automation|assist|automate|use case|use-case|copilot|workflow|decision)\b/i,
    `${company}'s practical AI opportunities`,
  );
  const joined = [
    research?.companyOverview,
    research?.industryContext,
    research?.keyPublicChallenges,
    research?.strategicTensions,
    research?.workshopHypotheses,
  ].flat().filter(Boolean).join(' ').toLowerCase();

  return {
    company,
    industry,
    aiFocus,
    workflowFocus: /workflow|handoff|repeat|queue|decision|exception/.test(joined)
      ? `${company}'s day-to-day workflows and decision points`
      : `${company}'s live workflows`,
    technologyFocus: /data|platform|tool|system|integration|technology/.test(joined)
      ? `${company}'s data, systems, and integration landscape`
      : `${company}'s current technology environment`,
    customerValueFocus: /customer|client|service|value|trust|promise/.test(joined)
      ? `${company}'s customer and service value`
      : `${company}'s delivered value`,
    governanceFocus: /policy|approval|governance|risk|compliance|audit/.test(joined)
      ? `${company}'s AI governance, policy, and assurance needs`
      : `${company}'s governance and control requirements`,
    partnerFocus: /vendor|partner|platform|third|external/.test(joined)
      ? `${company}'s external AI and platform dependencies`
      : `${company}'s external dependencies`,
  };
}

function interpolateAiScaleLevels(level1: string, level3: string, level5: string): string[] {
  return [
    level1,
    'Some AI-enabling signals are visible, but they remain inconsistent and too weak to support confident implementation.',
    level3,
    'Readiness and feasibility are improving in several areas, but the environment is not yet stable enough for broad AI use.',
    level5,
  ];
}

function stripLeadingQuestionStarter(text: string): string {
  return text
    .replace(/^(where do you see|what happens in|what happens|what helps|where do customers feel|where do customers|where do systems|where do)\s+/i, '')
    .replace(/\?$/, '')
    .trim();
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function chooseWorkshopDecision(
  tag: DiscoveryQuestion['tag'],
  defaults: {
    fix: string;
    scale: string;
    sequence?: string;
  },
): string {
  if (tag === 'working') return defaults.scale;
  if (tag === 'context' && defaults.sequence) return defaults.sequence;
  return defaults.fix;
}

function wrapOperationsExploratoryQuestion(
  baseQuestion: string,
  _tag: DiscoveryQuestion['tag'],
): string {
  return baseQuestion;
}

function wrapTransformationExploratoryQuestion(
  baseQuestion: string,
  _tag: DiscoveryQuestion['tag'],
): string {
  return baseQuestion;
}

function wrapAiExploratoryQuestion(
  baseQuestion: string,
  _tag: DiscoveryQuestion['tag'],
): string {
  return baseQuestion;
}

function wrapFinanceExploratoryQuestion(
  baseQuestion: string,
  _tag: DiscoveryQuestion['tag'],
): string {
  return baseQuestion;
}

function buildAiTripleRatingScale(
  lens: string,
  signal: AiDiscoverySignal,
  profile: AiContextProfile,
): string[] {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported AI lens for maturity scale: ${lens}`);
  }

  const scales: Record<CanonicalLensName, Record<string, [string, string, string]>> = {
    People: {
      adoption_readiness: [
        `People are not yet ready to trust or adopt AI in ${profile.aiFocus}.`,
        `Some teams are open to AI, but confidence and practical readiness remain uneven.`,
        `People are ready enough to adopt AI in ways that would improve work rather than disrupt it.`,
      ],
      trust_gap: [
        `Trust in AI-supported work is too weak for adoption to be credible.`,
        `Some trust is building, but concern about accuracy or judgement still limits use.`,
        `Trust is strong enough that AI could be used credibly in appropriate parts of the work.`,
      ],
      capability_gap: [
        `Capability gaps mean teams are not yet able to use AI well in practice.`,
        `Some capability is emerging, but important gaps still weaken implementation confidence.`,
        `Capability is strong enough that AI-supported work could be adopted without excessive dependence on specialists.`,
      ],
      role_anxiety: [
        `Role anxiety is high enough that AI would likely trigger resistance or defensive behaviour.`,
        `Some concerns are manageable, but anxiety still weakens openness to AI-supported change.`,
        `Role impact is understood clearly enough that AI can be introduced without avoidable fear or confusion.`,
      ],
      change_support: [
        `The environment is not yet supportive enough for AI-enabled change to land well.`,
        `Some support exists, but change conditions are still too uneven for broad adoption.`,
        `Change support is strong enough that AI adoption could be introduced in a controlled and practical way.`,
      ],
    },
    Operations: {
      automation_fit: [
        `Too much of ${profile.workflowFocus} is still too messy or variable for AI to help credibly.`,
        `Some workflow segments are a good fit, but AI opportunity is still limited by process inconsistency.`,
        `There are clear parts of the workflow where AI could improve speed or quality meaningfully.`,
      ],
      workflow_breakpoint: [
        `Key workflow breakpoints are so unstable that AI would likely amplify rather than reduce friction.`,
        `Some breakpoints are manageable, but AI would still struggle in too many live scenarios.`,
        `Workflow breakpoints are understood well enough that AI use cases can be chosen credibly.`,
      ],
      repeat_work: [
        `There is not yet enough stable repeat work identified for AI to add practical value confidently.`,
        `Some repeat work is visible, but it is not yet isolated clearly enough across the operation.`,
        `Repeat work is clear enough that strong AI-assisted use cases can be prioritised.`,
      ],
      exception_complexity: [
        `Exception handling is too complex and too frequent for AI to operate safely in key parts of the workflow.`,
        `Some exception-heavy areas are understood, but complexity still limits where AI can be trusted.`,
        `Exception complexity is visible enough that AI boundaries can be designed safely and practically.`,
      ],
      handoff_dependency: [
        `Handoff dependency is too high for AI to work well without wider process redesign.`,
        `Some handoff risks are manageable, but they still limit the reliability of AI use in live work.`,
        `Handoff points are clear enough that AI can be inserted without breaking the flow of work.`,
      ],
    },
    Technology: {
      data_readiness: [
        `${profile.technologyFocus} are not ready enough for AI to perform reliably.`,
        `Some data and systems are usable, but readiness is too uneven for confident implementation.`,
        `Data and systems are ready enough in the right places to support credible AI use cases.`,
      ],
      integration_constraint: [
        `Integration constraints are strong enough to limit what AI could do in practice.`,
        `Some integrations are workable, but important dependencies still weaken implementation feasibility.`,
        `Integration constraints are manageable enough that AI can be connected to the workflow credibly.`,
      ],
      tooling_gap: [
        `Tooling gaps are large enough that AI implementation would rely too heavily on manual workaround or custom effort.`,
        `Some tooling is usable, but important gaps still weaken the implementation path.`,
        `Tooling is strong enough that AI could be introduced with a realistic and controlled build path.`,
      ],
      platform_fit: [
        `The current platform environment is a weak fit for the AI ambition the business has in mind.`,
        `Some platform fit exists, but gaps still make broader AI use hard to support.`,
        `Platform fit is strong enough that the business can pursue practical AI opportunities with confidence.`,
      ],
      technical_risk: [
        `Technical risk is too high for AI to be introduced confidently in important workflows.`,
        `Some technical risk can be managed, but important gaps still threaten reliability or control.`,
        `Technical risk is understood and bounded well enough that AI can be introduced in the right places safely.`,
      ],
    },
    Commercial: {
      customer_value_opportunity: [
        `It is not yet clear where AI would improve ${profile.customerValueFocus} in ways customers would truly feel.`,
        `Some value opportunities are visible, but they are not yet sharp enough to guide prioritisation confidently.`,
        `There are clear areas where AI could improve value or quality in ways customers would genuinely notice.`,
      ],
      promise_risk: [
        `AI would create too much risk of overpromising value the operation cannot yet support.`,
        `Some AI promises could be made credibly, but the risk of stretching too far is still material.`,
        `The business can distinguish clearly between credible AI promises and risky ones.`,
      ],
      service_gain: [
        `AI service gains are too unclear or too weak to justify confident action yet.`,
        `Some service gains are visible, but the case is still inconsistent across the customer journey.`,
        `Service gains are clear enough that the business can prioritise AI where it would improve the customer outcome most.`,
      ],
      trust_risk: [
        `AI would create too much customer trust risk in parts of the work that matter most.`,
        `Some trust risk is manageable, but it still limits where AI can be used safely.`,
        `Customer trust risks are understood well enough that AI can be targeted without weakening confidence.`,
      ],
      differentiation_opportunity: [
        `It is not yet clear where AI would create a meaningful differentiated outcome rather than generic noise.`,
        `Some differentiation opportunity is visible, but it is still too uneven or weak in key areas.`,
        `The business can see clearly where AI would create a stronger and more credible customer proposition.`,
      ],
    },
    Customer: {
      customer_value_opportunity: [
        `It is not yet clear where AI would improve ${profile.customerValueFocus} in ways customers would genuinely notice.`,
        `Some customer-facing AI opportunities are visible, but they are not yet sharp enough to guide prioritisation confidently.`,
        `There are clear customer moments where AI could improve experience, responsiveness, or value in a way customers would genuinely feel.`,
      ],
      promise_risk: [
        `AI would create too much risk of promising a better customer experience than the business could actually sustain.`,
        `Some AI-led customer promises could be made credibly, but the risk of overclaiming is still material.`,
        `The business can separate credible customer-facing AI improvements from promises that would weaken trust.`,
      ],
      service_gain: [
        `It is not yet clear where AI would make the customer experience meaningfully smoother or faster.`,
        `Some customer service gains are visible, but they are still inconsistent across the journey.`,
        `Customer-facing service gains are clear enough that AI could be targeted where it would reduce effort or delay most.`,
      ],
      trust_risk: [
        `AI would create too much trust risk in customer moments that matter most.`,
        `Some customer trust risk is manageable, but it still limits where AI can be used confidently.`,
        `Customer trust risks are understood well enough that AI can be introduced without eroding confidence.`,
      ],
      differentiation_opportunity: [
        `It is not yet clear where AI would create a meaningfully better customer relationship rather than generic novelty.`,
        `Some differentiation opportunity is visible, but it is still too uneven in the customer journey.`,
        `The business can see clearly where AI would make the customer experience feel stronger, faster, or more responsive.`,
      ],
    },
    'Risk/Compliance': {
      governance_requirement: [
        `${profile.governanceFocus} are too underdeveloped for AI to be introduced safely in important work.`,
        `Some governance exists, but it is not yet strong enough to support AI confidently across the right use cases.`,
        `Governance is strong enough that AI can be introduced in a controlled and auditable way.`,
      ],
      approval_barrier: [
        `Approval barriers are likely to stall AI even where the use case looks practical.`,
        `Some approvals are manageable, but governance friction still weakens implementation pace.`,
        `Approval flow is clear enough that realistic AI initiatives could move without avoidable delay.`,
      ],
      compliance_constraint: [
        `Compliance constraints are too strong or too unclear for AI use to be trusted safely in practice.`,
        `Some constraints are understood, but they still narrow the feasible AI space materially.`,
        `Compliance constraints are explicit enough that safe AI use cases can be chosen credibly.`,
      ],
      assurance_need: [
        `Assurance needs are too high and too unresolved for AI to be introduced confidently.`,
        `Some assurance requirements are known, but they still create uncertainty around live use.`,
        `Assurance needs are understood well enough that AI can be implemented with credible control.`,
      ],
      risk_exposure: [
        `AI risk exposure is too high or too ambiguous for confident implementation in important workflows.`,
        `Some risks are bounded, but significant exposure still limits where AI can be trusted.`,
        `Risk exposure is understood and contained well enough that practical AI use is credible.`,
      ],
    },
    Partners: {
      vendor_dependency: [
        `${profile.partnerFocus} create too much vendor dependence for AI choices to feel safe or flexible.`,
        `Some vendor dependence is manageable, but it still weakens the credibility of the AI path.`,
        `Vendor dependence is clear and manageable enough that the business can move without hidden lock-in risk.`,
      ],
      platform_dependency: [
        `Platform dependence is too strong for the business to introduce AI flexibly in the right places.`,
        `Some platform dependencies are workable, but they still narrow what AI can realistically do.`,
        `Platform dependencies are clear enough that AI opportunities can be chosen around them credibly.`,
      ],
      external_data_risk: [
        `External data dependence creates too much risk for AI to be trusted safely in important use cases.`,
        `Some external data risks are manageable, but they still weaken confidence in AI feasibility.`,
        `External data risk is understood well enough that safe AI use cases can be separated from unsafe ones.`,
      ],
      partner_constraint: [
        `Partners or vendors are constraining what AI the business can realistically implement.`,
        `Some partner constraints are manageable, but they still weaken speed or flexibility materially.`,
        `Partner constraints are visible enough that the AI path can be planned without hidden external blockers.`,
      ],
      partner_enablement: [
        `External partners are not yet enabling AI strongly enough where their support is required.`,
        `Some partner enablement exists, but it is not yet consistent enough to rely on.`,
        `Partners provide enough enablement that the business can move confidently on the right AI opportunities.`,
      ],
    },
  };

  return interpolateAiScaleLevels(...scales[canonicalLens][signal]);
}

function buildAiLensPlan(lens: string): AiLensPlan {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported AI lens: ${lens}`);
  }

  const plans: Record<CanonicalLensName, AiLensPlan> = {
    People: {
      tripleSignal: 'adoption_readiness',
      tripleFocus: 'whether people are ready to use AI credibly in practice',
      exploratory: [
        {
          signal: 'trust_gap',
          tag: 'gaps',
          purpose: 'Reveal where people would not trust AI output yet.',
          buildQuestion: (profile) => `Where do you see people most reluctant to trust AI in their work at ${profile.company}?`,
        },
        {
          signal: 'capability_gap',
          tag: 'constraint',
          purpose: 'Identify where skills or confidence are too weak for adoption.',
          buildQuestion: (profile) => `Where do you see capability gaps making it hard for teams to use AI well in day-to-day work?`,
        },
        {
          signal: 'role_anxiety',
          tag: 'pain_points',
          purpose: 'Surface where AI would trigger resistance or anxiety.',
          buildQuestion: (profile) => `Where do you see concern about role impact making people more cautious or resistant to AI-supported change?`,
        },
        {
          signal: 'change_support',
          tag: 'working',
          purpose: 'Show where people conditions already support adoption.',
          buildQuestion: (profile) => `What happens in the parts of the organisation where people already feel open to trying AI in a practical way?`,
        },
      ],
    },
    Operations: {
      tripleSignal: 'automation_fit',
      tripleFocus: 'whether the workflow is ready for practical AI use',
      exploratory: [
        {
          signal: 'repeat_work',
          tag: 'gaps',
          purpose: 'Reveal where there is enough repeat work for AI to help.',
          buildQuestion: (profile) => `Where do you see repeat work in ${profile.workflowFocus} that AI could realistically reduce?`,
        },
        {
          signal: 'exception_complexity',
          tag: 'constraint',
          purpose: 'Identify where workflow variation would limit AI usefulness.',
          buildQuestion: (profile) => `Where do exceptions or edge cases make AI harder to trust in ${profile.workflowFocus}?`,
        },
        {
          signal: 'handoff_dependency',
          tag: 'pain_points',
          purpose: 'Surface where fragmented flow would block AI.',
          buildQuestion: (profile) => `Where do handoffs make the workflow too fragmented for AI to help cleanly?`,
        },
        {
          signal: 'workflow_breakpoint',
          tag: 'working',
          purpose: 'Show where workflow structure already supports AI.',
          buildQuestion: (profile) => `What happens in the parts of the workflow that already feel structured enough for AI to be useful?`,
        },
      ],
    },
    Technology: {
      tripleSignal: 'data_readiness',
      tripleFocus: 'whether data and systems are ready enough for credible AI use',
      exploratory: [
        {
          signal: 'integration_constraint',
          tag: 'gaps',
          purpose: 'Reveal where integration reality weakens feasibility.',
          buildQuestion: (profile) => `Where do you see integration constraints making AI harder to connect to live work?`,
        },
        {
          signal: 'tooling_gap',
          tag: 'constraint',
          purpose: 'Identify tooling gaps that weaken the implementation path.',
          buildQuestion: (profile) => `Where do you see tooling gaps making it harder to implement AI in a controlled way?`,
        },
        {
          signal: 'technical_risk',
          tag: 'pain_points',
          purpose: 'Surface where technical risk is still too high.',
          buildQuestion: (profile) => `Where do you see technical risk making AI feel unsafe or unreliable in practice?`,
        },
        {
          signal: 'platform_fit',
          tag: 'working',
          purpose: 'Show where the current technical base already supports AI.',
          buildQuestion: (profile) => `What happens in the parts of ${profile.technologyFocus} that already make practical AI use feel achievable?`,
        },
      ],
    },
    Commercial: {
      tripleSignal: 'customer_value_opportunity',
      tripleFocus: 'whether AI would improve customer value in ways that matter',
      exploratory: [
        {
          signal: 'service_gain',
          tag: 'gaps',
          purpose: 'Reveal where AI could improve the service outcome clearly.',
          buildQuestion: (profile) => `Where do you see the clearest service gain if AI worked well in ${profile.aiFocus}?`,
        },
        {
          signal: 'promise_risk',
          tag: 'constraint',
          purpose: 'Identify where AI would create overpromise risk.',
          buildQuestion: (profile) => `Where would AI create too much promise risk for the business to use it credibly today?`,
        },
        {
          signal: 'trust_risk',
          tag: 'pain_points',
          purpose: 'Surface where AI could weaken customer trust.',
          buildQuestion: (profile) => `Where do you see the highest risk that AI would weaken customer trust rather than improve ${profile.customerValueFocus}?`,
        },
        {
          signal: 'differentiation_opportunity',
          tag: 'working',
          purpose: 'Show where AI could strengthen the proposition meaningfully.',
          buildQuestion: (profile) => `What happens in the areas where AI could most clearly strengthen the value customers receive?`,
        },
      ],
    },
    Customer: {
      tripleSignal: 'customer_value_opportunity',
      tripleFocus: 'whether AI could improve the lived customer experience in ways people would actually notice',
      exploratory: [
        {
          signal: 'service_gain',
          tag: 'working',
          purpose: 'Reveal where AI could visibly improve customer responsiveness or quality.',
          buildQuestion: (profile) => `Where in the customer journey would AI most clearly improve responsiveness, quality, or ease for customers at ${profile.company}?`,
        },
        {
          signal: 'trust_risk',
          tag: 'constraint',
          purpose: 'Surface where AI could damage customer confidence.',
          buildQuestion: (profile) => `Where would customers be least willing to accept AI because trust or reassurance matters too much?`,
        },
        {
          signal: 'promise_risk',
          tag: 'pain_points',
          purpose: 'Identify where AI-led promises could outrun operational reality.',
          buildQuestion: (profile) => `Where would it be easiest to overpromise a better customer experience with AI before the business could actually deliver it?`,
        },
        {
          signal: 'differentiation_opportunity',
          tag: 'gaps',
          purpose: 'Show where AI could create a more distinctive customer experience.',
          buildQuestion: (profile) => `Where could AI make the customer experience feel meaningfully different from alternatives rather than just more automated?`,
        },
      ],
    },
    'Risk/Compliance': {
      tripleSignal: 'governance_requirement',
      tripleFocus: 'whether governance and control are strong enough for safe AI use',
      exploratory: [
        {
          signal: 'approval_barrier',
          tag: 'gaps',
          purpose: 'Reveal where approvals would stall practical AI use.',
          buildQuestion: (profile) => `Where do you see approvals likely to slow or block practical AI use most?`,
        },
        {
          signal: 'compliance_constraint',
          tag: 'constraint',
          purpose: 'Identify where compliance narrows feasible use cases.',
          buildQuestion: (profile) => `Where do compliance or policy constraints most clearly narrow what AI could do safely?`,
        },
        {
          signal: 'risk_exposure',
          tag: 'pain_points',
          purpose: 'Surface where AI risk still feels too high.',
          buildQuestion: (profile) => `Where do you see AI risk feeling too exposed for the business to move confidently?`,
        },
        {
          signal: 'assurance_need',
          tag: 'working',
          purpose: 'Show where control conditions already support safer experimentation.',
          buildQuestion: (profile) => `What happens in the areas where governance and assurance already make controlled AI use feel more realistic?`,
        },
      ],
    },
    Partners: {
      tripleSignal: 'vendor_dependency',
      tripleFocus: 'how much external dependency shapes whether AI is practical',
      exploratory: [
        {
          signal: 'platform_dependency',
          tag: 'gaps',
          purpose: 'Reveal where platform dependence narrows AI choice.',
          buildQuestion: (profile) => `Where do you see platform dependence limiting what AI the business could realistically use?`,
        },
        {
          signal: 'external_data_risk',
          tag: 'constraint',
          purpose: 'Identify where outside data dependence creates risk.',
          buildQuestion: (profile) => `Where do you see dependence on external data or services making AI harder to trust?`,
        },
        {
          signal: 'partner_constraint',
          tag: 'pain_points',
          purpose: 'Surface where vendors or partners slow implementation.',
          buildQuestion: (profile) => `Where do partners or vendors make AI implementation slower or less flexible than it needs to be?`,
        },
        {
          signal: 'partner_enablement',
          tag: 'working',
          purpose: 'Show where external capability already helps the AI path.',
          buildQuestion: (profile) => `What happens in the areas where external platforms or partners already make practical AI use easier?`,
        },
      ],
    },
  };

  return plans[canonicalLens];
}

function buildAiTripleRatingQuestion(
  lens: string,
  plan: AiLensPlan,
  profile: AiContextProfile,
): DiscoveryQuestion {
  return {
    id: nanoid(8),
    text: `Based on what you see in current work today, where is ${plan.tripleFocus}, where should it be for ${profile.aiFocus}, and where will it end up if nothing changes?`,
    tag: 'triple_rating',
    maturityScale: buildAiTripleRatingScale(lens, plan.tripleSignal, profile),
    purpose: `Assess the current, target, and projected state of ${plan.tripleFocus} for practical AI implementation.`,
    isEdited: false,
  };
}

function buildContextualAiDiscoveryLensQuestions(
  lens: string,
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): DiscoveryLensQuestions {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported AI lens: ${lens}`);
  }

  const profile = buildAiContextProfile(context, research);
  const plan = buildAiLensPlan(canonicalLens);
  const questions: DiscoveryQuestion[] = [
    buildAiTripleRatingQuestion(canonicalLens, plan, profile),
    ...plan.exploratory.map((entry) => ({
      id: nanoid(8),
      text: wrapAiExploratoryQuestion(entry.buildQuestion(profile), entry.tag),
      tag: entry.tag,
      purpose: entry.purpose,
      isEdited: false,
    })),
  ];

  return {
    key: canonicalLens,
    label: canonicalLens,
    questions,
  };
}

export function buildContextualAiDiscoveryQuestionSet(
  lensNames: string[],
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  rationale: string,
  direction?: string | null,
): DiscoveryQuestionSet {
  return {
    lenses: lensNames.map((lens) => buildContextualAiDiscoveryLensQuestions(lens, context, research)),
    generatedAtMs: Date.now(),
    agentRationale: rationale,
    facilitatorDirection: direction || null,
  };
}

function buildFinanceContextProfile(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): FinanceContextProfile {
  const company = context.clientName?.trim() || 'the business';
  const industry = context.industry?.trim() || 'the current operation';
  const phrases = [
    ...splitCommercialPhrases(context.workshopPurpose),
    ...splitCommercialPhrases(context.desiredOutcomes),
    ...splitCommercialPhrases(research?.workshopBrief),
    ...splitCommercialPhrases(research?.keyFacilitatorInsight),
    ...splitCommercialPhrases(research?.strategicTensions?.join('. ')),
    ...splitCommercialPhrases(research?.workshopHypotheses?.join('. ')),
  ];
  // Prefer a phrase that explicitly names "leakage" — strip imperative verb prefix if present
  const rawLeakageFocus = pickContextPhrase(phrases, /\bleakage\b/i, '', 6);
  const strippedLeakageFocus = rawLeakageFocus
    ? rawLeakageFocus
        .replace(/^(reduce|remove|identify|eliminate|stop|fix|address|avoid|cut|improve|decrease|minimise|minimize)\s+/i, '')
        .trim()
    : '';
  const valueFocus = strippedLeakageFocus ||
    pickContextPhrase(
      phrases,
      /\b(value|cost|margin|economics|leakage|waste|rework|efficiency|return|cost-to-serve|pricing)\b/i,
      `${company}'s value leakage and cost-to-serve`,
    );
  const joined = [
    research?.companyOverview,
    research?.industryContext,
    research?.keyPublicChallenges,
    research?.strategicTensions,
    research?.workshopHypotheses,
  ].flat().filter(Boolean).join(' ').toLowerCase();

  return {
    company,
    industry,
    valueFocus,
    operatingValueFocus: /workflow|handoff|delay|queue|rework|delivery|service/.test(joined)
      ? `${company}'s workflow waste, delay, and rework`
      : `${company}'s avoidable operational effort`,
    technologyValueFocus: /system|tool|data|automation|platform|technology/.test(joined)
      ? `${company}'s systems, tooling, automation, and data effort`
      : `${company}'s technology-driven effort`,
    commercialValueFocus: /client|customer|scope|pricing|value|promise|commercial/.test(joined)
      ? `${company}'s client mix, scope shape, and commercial choices`
      : `${company}'s commercially unattractive work`,
    controlValueFocus: /approval|control|governance|risk|compliance|policy|audit/.test(joined)
      ? `${company}'s approvals, controls, and governance drag`
      : `${company}'s protection-versus-drag balance`,
    partnerValueFocus: /partner|vendor|supplier|outsourc|third/.test(joined)
      ? `${company}'s supplier, partner, and outsourcing overhead`
      : `${company}'s external dependency overhead`,
  };
}

function interpolateFinanceScaleLevels(level1: string, level3: string, level5: string): string[] {
  return [
    level1,
    'Some stronger value signals are visible, but too much effort, delay, or complexity still leaks value across the work.',
    level3,
    'Value conversion is improving in several areas, but the business still carries too much avoidable drag in important workflows.',
    level5,
  ];
}

function buildFinanceTripleRatingScale(
  lens: string,
  signal: FinanceDiscoverySignal,
  profile: FinanceContextProfile,
): string[] {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Finance lens for maturity scale: ${lens}`);
  }

  const scales: Record<CanonicalLensName, Record<string, [string, string, string]>> = {
    People: {
      decision_quality: [
        `Day-to-day decisions regularly increase effort or weaken value in ${profile.valueFocus}.`,
        `Some decisions protect value well, but too many still create avoidable effort, leakage, or low-return work.`,
        `Decision quality is strong enough that day-to-day choices consistently protect value and avoid waste.`,
      ],
      ownership_gap: [
        `Ownership for value leakage is unclear enough that avoidable drag keeps getting passed around.`,
        `Some ownership is clear, but too many leakage points still have no one fixing them end to end.`,
        `Ownership is clear enough that value leakage gets surfaced and resolved rather than absorbed silently.`,
      ],
      capability_gap: [
        `Capability gaps mean teams cannot spot or stop avoidable value leakage reliably.`,
        `Some teams recognise weak-value work, but capability is still too uneven to act on it consistently.`,
        `Capability is strong enough that teams can recognise and reduce weak-value work in practice.`,
      ],
      incentive_misalignment: [
        `Current incentives still reward work that looks busy but weakens value conversion.`,
        `Some incentives are improving, but they still tolerate behaviour that creates avoidable drag.`,
        `Incentives align strongly enough that people are rewarded for protecting value, not just pushing work through.`,
      ],
      cost_awareness: [
        `People cannot see clearly enough where effort is being wasted or where work becomes unattractive.`,
        `Some awareness exists, but it is still too weak to change choices consistently in live work.`,
        `Cost and value awareness are clear enough that teams can challenge weak-value work early.`,
      ],
    },
    Operations: {
      rework_cost: [
        `Rework is consuming so much effort that too much of ${profile.operatingValueFocus} fails to translate into value.`,
        `Some rework has been reduced, but it still destroys too much capacity in important parts of the workflow.`,
        `Rework is low enough that most operational effort converts cleanly into delivered value.`,
      ],
      delay_cost: [
        `Delays and waiting time repeatedly turn otherwise viable work into weak-value work.`,
        `Some delays are manageable, but too many workflows still consume effort without enough return.`,
        `Delays are controlled well enough that time is not being lost materially in value-critical workflows.`,
      ],
      complexity_drag: [
        `Operational complexity is high enough that too much effort is being consumed just to keep work moving.`,
        `Some complexity is understood, but it still creates too much avoidable drag in live operations.`,
        `Operational complexity is contained well enough that effort converts into value more predictably.`,
      ],
      flow_waste: [
        `The flow of work contains enough waste that value leaks out across handoffs and repeat handling.`,
        `Some flow waste has been reduced, but key steps still consume effort without improving the outcome.`,
        `Workflow waste is low enough that the operation moves work through with limited avoidable drag.`,
      ],
      throughput_value: [
        `Throughput is too weak or too distorted to convert operational effort into healthy value consistently.`,
        `Some throughput is productive, but uneven flow still weakens overall value conversion.`,
        `Throughput is strong enough that effort is translating into useful output without excess waste.`,
      ],
    },
    Technology: {
      manual_effort: [
        `${profile.technologyValueFocus} still depend too heavily on manual effort that should not be there.`,
        `Some manual effort has been reduced, but too many steps still rely on avoidable human workaround.`,
        `Manual effort is low enough that systems are supporting value creation instead of absorbing time.`,
      ],
      tooling_waste: [
        `Tooling friction consumes too much time without improving outcome quality or value.`,
        `Some tools help, but too many still create duplication, switching cost, or avoidable effort.`,
        `Tooling supports work well enough that systems remove drag rather than create it.`,
      ],
      data_rework: [
        `Poor or fragmented data causes repeat correction work often enough to destroy value.`,
        `Some data issues are understood, but rework still appears too often in important tasks.`,
        `Data quality is strong enough that teams do not repeatedly lose effort correcting or chasing information.`,
      ],
      automation_gap: [
        `Automation gaps leave too much repeat effort in place across ${profile.technologyValueFocus}.`,
        `Some automation exists, but too many high-effort steps still remain manual or fragmented.`,
        `Automation is reducing enough repeat effort that technology is improving value conversion materially.`,
      ],
      system_cost_drag: [
        `System design creates enough drag that the business spends too much effort just managing the work.`,
        `Some system drag is manageable, but important workflows still cost more effort than they should.`,
        `System design is efficient enough that technology no longer adds avoidable cost-to-serve in core work.`,
      ],
    },
    Commercial: {
      weak_fit_work: [
        `${profile.commercialValueFocus} still include too much work that looks attractive but weakens economics in delivery.`,
        `Some weak-fit work is being challenged, but too many low-value opportunities still get accepted.`,
        `Weak-fit work is filtered out early enough that commercial effort is focused on healthier opportunities.`,
      ],
      promise_overstretch: [
        `Promises are being stretched far enough that work becomes unattractive once delivery starts.`,
        `Some overstretch is recognised, but it still creates weak-value work in important client situations.`,
        `Commercial promises are disciplined enough that sold work remains economically supportable.`,
      ],
      value_mismatch: [
        `The business is still doing work where the effort required is out of proportion to the value created.`,
        `Some value mismatch is understood, but weak-return work still slips through too often.`,
        `Client work is shaped well enough that effort and value stay in a healthier balance.`,
      ],
      pricing_pressure: [
        `Pricing pressure is accepted too often in work that already carries heavy effort or complexity.`,
        `Some pricing choices are disciplined, but low-confidence pricing still weakens value in important deals.`,
        `Pricing discipline is strong enough that commercially weak work is challenged before it lands.`,
      ],
      commercial_drag: [
        `Commercial choices are still creating avoidable drag that weakens value conversion after sale.`,
        `Some drag is visible and manageable, but commercial decisions still create too much downstream effort.`,
        `Commercial choices support healthier economics and reduce avoidable drag through delivery.`,
      ],
    },
    Customer: {
      retention_value: [
        `Customer relationships are not stable enough yet to protect value in ${profile.commercialValueFocus}.`,
        `Some customer relationships are healthy, but retention value still varies too much across the base.`,
        `Customer relationships are strong enough that retention consistently protects value rather than leaking it.`,
      ],
      churn_cost: [
        `Customer loss is creating more avoidable value leakage than the business can currently explain or absorb.`,
        `Some churn patterns are understood, but customer loss still destroys too much value in important areas.`,
        `Churn is understood and controlled well enough that avoidable customer loss no longer weakens value materially.`,
      ],
      service_expectation_gap: [
        `Customer expectations are out of line with what the business can deliver economically.`,
        `Some expectation gaps are known, but they still create weak-value work and avoidable recovery effort.`,
        `Customer expectations are shaped well enough that service remains supportable and value-positive.`,
      ],
      experience_loyalty: [
        `The customer experience is not strong enough yet to create reliable loyalty or repeat value.`,
        `Some loyalty drivers are visible, but the experience is still too inconsistent to protect value fully.`,
        `The customer experience is strong enough that loyalty and repeat value reinforce the economics.`,
      ],
      customer_effort_cost: [
        `Customers still face enough friction that the business absorbs avoidable service cost and lost value.`,
        `Some customer effort has been reduced, but friction still creates too much avoidable cost in key journeys.`,
        `Customer effort is low enough that the experience supports value rather than creating hidden cost.`,
      ],
    },
    'Risk/Compliance': {
      approval_cost: [
        `${profile.controlValueFocus} add enough approval effort that value is lost before the work even moves.`,
        `Some approvals are proportionate, but too many still consume effort without enough return.`,
        `Approval steps are proportionate enough that they protect value without excessive operational drag.`,
      ],
      control_drag: [
        `Controls add too much friction relative to the value they protect in live work.`,
        `Some controls are well-designed, but others still create drag that outweighs their practical benefit.`,
        `Controls are balanced well enough that they protect value without undermining efficiency.`,
      ],
      compliance_overhead: [
        `Compliance overhead is high enough that teams spend too much effort maintaining control rather than creating value.`,
        `Some compliance work is necessary, but overhead still exceeds the value of protection in key areas.`,
        `Compliance effort is proportionate enough that it protects the business without draining excessive capacity.`,
      ],
      assurance_value: [
        `Assurance activity is too weak or too poorly targeted to offset the effort it consumes.`,
        `Some assurance adds clear value, but too much still feels disconnected from the operational reality it slows.`,
        `Assurance is targeted well enough that it protects value in the areas that matter without unnecessary overhead.`,
      ],
      governance_delay: [
        `Governance delay regularly turns workable action into stalled effort and avoidable leakage.`,
        `Some governance friction is manageable, but delay still weakens decision speed and value conversion.`,
        `Governance moves quickly enough that value is protected without work stalling in avoidable delay.`,
      ],
    },
    Partners: {
      supplier_cost_drag: [
        `${profile.partnerValueFocus} add too much supplier cost or coordination effort for the value they return.`,
        `Some external relationships are efficient, but others still create unacceptable drag in live delivery.`,
        `Supplier and partner economics are strong enough that external dependencies add value rather than hidden cost.`,
      ],
      dependency_overhead: [
        `Dependency overhead is high enough that too much effort is spent coordinating rather than delivering value.`,
        `Some dependencies are manageable, but coordination cost still weakens value conversion materially.`,
        `External dependencies are simple enough that they do not consume disproportionate internal effort.`,
      ],
      partner_value_gap: [
        `Some partners absorb effort without returning enough practical value to justify the dependence.`,
        `Partner contribution is mixed, and too many dependencies still weaken rather than strengthen the economics.`,
        `Partner contribution is clear enough that external dependence improves value rather than diluting it.`,
      ],
      outsource_efficiency: [
        `Outsourced work is not efficient enough yet to justify the effort and coordination it requires.`,
        `Some outsourced work is effective, but efficiency is still too uneven in important areas.`,
        `Outsourced work is efficient enough that it improves value conversion rather than weakening it.`,
      ],
      external_rework: [
        `External rework and correction consume too much effort across partner-dependent workflows.`,
        `Some external rework is contained, but it still weakens performance in key parts of the delivery chain.`,
        `External rework is low enough that partner-dependent work does not carry hidden effort penalties.`,
      ],
    },
  };

  return interpolateFinanceScaleLevels(...scales[canonicalLens][signal]);
}

function buildFinanceLensPlan(lens: string): FinanceLensPlan {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Finance lens: ${lens}`);
  }

  const plans: Record<CanonicalLensName, FinanceLensPlan> = {
    People: {
      tripleSignal: 'decision_quality',
      tripleFocus: 'how strongly day-to-day people decisions protect value instead of leaking it',
      exploratory: [
        {
          signal: 'ownership_gap',
          tag: 'gaps',
          purpose: 'Reveal where leakage persists because no one owns it end to end.',
          buildQuestion: (profile) => `Where do you see effort or value leakage continuing because ownership is unclear across ${profile.valueFocus}?`,
        },
        {
          signal: 'capability_gap',
          tag: 'constraint',
          purpose: 'Identify capability gaps that stop teams reducing weak-value work.',
          buildQuestion: (profile) => `Where do you see capability gaps making it hard for teams to spot or stop work that is consuming effort without enough return?`,
        },
        {
          signal: 'incentive_misalignment',
          tag: 'pain_points',
          purpose: 'Surface behaviours that reward throughput over value.',
          buildQuestion: (profile) => `Where do current incentives encourage teams to push work through even when it looks low-value or too effort-heavy?`,
        },
        {
          signal: 'cost_awareness',
          tag: 'working',
          purpose: 'Show where teams already challenge weak-value effort early.',
          buildQuestion: (profile) => `What happens in the parts of the business where people already recognise weak-value work early enough to challenge it?`,
        },
      ],
    },
    Operations: {
      tripleSignal: 'rework_cost',
      tripleFocus: 'how much operational effort is leaking through rework, delay, and complexity',
      exploratory: [
        {
          signal: 'delay_cost',
          tag: 'gaps',
          purpose: 'Reveal where waiting time weakens value conversion.',
          buildQuestion: (profile) => `Where do delays or waiting time most clearly turn ${profile.operatingValueFocus} into avoidable cost?`,
        },
        {
          signal: 'complexity_drag',
          tag: 'constraint',
          purpose: 'Identify where complexity absorbs too much effort.',
          buildQuestion: (profile) => `Where is workflow complexity consuming disproportionate effort without improving the outcome?`,
        },
        {
          signal: 'flow_waste',
          tag: 'pain_points',
          purpose: 'Surface where the flow of work contains obvious waste.',
          buildQuestion: (profile) => `Where do handoffs or repeat steps create the clearest waste across ${profile.operatingValueFocus}?`,
        },
        {
          signal: 'throughput_value',
          tag: 'working',
          purpose: 'Show where the operation already converts effort into value efficiently.',
          buildQuestion: (profile) => `What happens in the workflows where effort already converts into useful output without much waste or repeat handling?`,
        },
      ],
    },
    Technology: {
      tripleSignal: 'manual_effort',
      tripleFocus: 'how much technology is reducing effort versus adding avoidable cost-to-serve',
      exploratory: [
        {
          signal: 'tooling_waste',
          tag: 'gaps',
          purpose: 'Reveal where tooling creates duplication or switching cost.',
          buildQuestion: (profile) => `Where do tools or systems create duplicate work or switching effort across ${profile.technologyValueFocus}?`,
        },
        {
          signal: 'data_rework',
          tag: 'constraint',
          purpose: 'Identify where poor data quality creates repeat correction effort.',
          buildQuestion: (profile) => `Where does missing or poor-quality data create repeat correction effort that should not be there?`,
        },
        {
          signal: 'automation_gap',
          tag: 'pain_points',
          purpose: 'Surface where high-effort tasks remain manual unnecessarily.',
          buildQuestion: (profile) => `Where are teams still doing manual repeat work that technology should already have taken out?`,
        },
        {
          signal: 'system_cost_drag',
          tag: 'working',
          purpose: 'Show where technology already removes effort well.',
          buildQuestion: (profile) => `What happens in the parts of the workflow where systems already reduce effort and avoidable cost-to-serve most clearly?`,
        },
      ],
    },
    Commercial: {
      tripleSignal: 'weak_fit_work',
      tripleFocus: 'how clearly the business filters out commercially weak or effort-heavy work',
      exploratory: [
        {
          signal: 'promise_overstretch',
          tag: 'gaps',
          purpose: 'Reveal where promises create unattractive economics after sale.',
          buildQuestion: (profile) => `Where do client promises or scope commitments most often turn otherwise attractive work into something uneconomic to deliver?`,
        },
        {
          signal: 'value_mismatch',
          tag: 'constraint',
          purpose: 'Identify where effort and value are out of balance.',
          buildQuestion: (profile) => `Where does the effort required for client work feel out of proportion to the value the business gets back?`,
        },
        {
          signal: 'pricing_pressure',
          tag: 'pain_points',
          purpose: 'Surface where pricing or commercial pressure weakens economics.',
          buildQuestion: (profile) => `Where is pricing or commercial pressure being accepted on work that already looks too effort-heavy to be attractive?`,
        },
        {
          signal: 'commercial_drag',
          tag: 'working',
          purpose: 'Show where commercial choices already protect value.',
          buildQuestion: (profile) => `What happens in the work that the business prices, scopes, and shapes well enough to protect value through delivery?`,
        },
      ],
    },
    Customer: {
      tripleSignal: 'retention_value',
      tripleFocus: 'how strongly the customer relationship protects value instead of leaking it',
      exploratory: [
        {
          signal: 'churn_cost',
          tag: 'pain_points',
          purpose: 'Reveal where customer loss is destroying value.',
          buildQuestion: () => `Where do you see customer loss or weak renewal behaviour creating the clearest value leakage today?`,
        },
        {
          signal: 'service_expectation_gap',
          tag: 'constraint',
          purpose: 'Identify where customer expectations create weak-value work.',
          buildQuestion: () => `Where are customer expectations hardest to meet without creating too much effort or unattractive economics?`,
        },
        {
          signal: 'customer_effort_cost',
          tag: 'gaps',
          purpose: 'Surface where customer friction creates avoidable cost.',
          buildQuestion: () => `Where does customer effort or repeated chasing create the most avoidable cost-to-serve?`,
        },
        {
          signal: 'experience_loyalty',
          tag: 'working',
          purpose: 'Show where the experience already protects value through loyalty.',
          buildQuestion: () => `What happens in the parts of the customer experience that already create strong loyalty or repeat value?`,
        },
      ],
    },
    'Risk/Compliance': {
      tripleSignal: 'control_drag',
      tripleFocus: 'how proportionate approvals and controls are to the value they protect',
      exploratory: [
        {
          signal: 'approval_cost',
          tag: 'gaps',
          purpose: 'Reveal where approvals cost more effort than they should.',
          buildQuestion: (profile) => `Where do approvals add the most avoidable effort or delay across ${profile.controlValueFocus}?`,
        },
        {
          signal: 'compliance_overhead',
          tag: 'constraint',
          purpose: 'Identify where compliance work creates excessive overhead.',
          buildQuestion: (profile) => `Where does compliance activity consume disproportionate effort relative to the protection it gives?`,
        },
        {
          signal: 'governance_delay',
          tag: 'pain_points',
          purpose: 'Surface where governance slows action enough to weaken value conversion.',
          buildQuestion: (profile) => `Where do governance or control decisions take so long that workable action loses momentum or value?`,
        },
        {
          signal: 'assurance_value',
          tag: 'working',
          purpose: 'Show where assurance activity already protects value well.',
          buildQuestion: (profile) => `What happens in the areas where checks or assurance activity already protect value without creating too much drag?`,
        },
      ],
    },
    Partners: {
      tripleSignal: 'supplier_cost_drag',
      tripleFocus: 'how much partner and supplier dependence is helping or weakening value conversion',
      exploratory: [
        {
          signal: 'dependency_overhead',
          tag: 'gaps',
          purpose: 'Reveal where coordination with third parties consumes too much effort.',
          buildQuestion: (profile) => `Where do partner or supplier dependencies create the most coordination effort without enough return?`,
        },
        {
          signal: 'partner_value_gap',
          tag: 'constraint',
          purpose: 'Identify where partners absorb effort without enough value back.',
          buildQuestion: (profile) => `Where do external partners create work or dependence that does not feel justified by the value they add?`,
        },
        {
          signal: 'external_rework',
          tag: 'pain_points',
          purpose: 'Surface where partner-dependent work creates repeat correction effort.',
          buildQuestion: (profile) => `Where does supplier or outsourced rework create the clearest hidden effort penalty in live delivery?`,
        },
        {
          signal: 'outsource_efficiency',
          tag: 'working',
          purpose: 'Show where external partners already improve value conversion.',
          buildQuestion: (profile) => `What happens in the partner-dependent work that already runs efficiently enough to improve value rather than dilute it?`,
        },
      ],
    },
  };

  return plans[canonicalLens];
}

function buildFinanceTripleRatingQuestion(
  lens: string,
  plan: FinanceLensPlan,
  profile: FinanceContextProfile,
): DiscoveryQuestion {
  return {
    id: nanoid(8),
    text: `Based on what you see in current work today, where is ${plan.tripleFocus}, where should it be to strengthen ${profile.valueFocus}, and where will it end up if nothing changes?`,
    tag: 'triple_rating',
    maturityScale: buildFinanceTripleRatingScale(lens, plan.tripleSignal, profile),
    purpose: `Assess the current, target, and projected state of ${plan.tripleFocus} in the live economics of the work.`,
    isEdited: false,
  };
}

function buildContextualFinanceDiscoveryLensQuestions(
  lens: string,
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): DiscoveryLensQuestions {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Finance lens: ${lens}`);
  }

  const profile = buildFinanceContextProfile(context, research);
  const plan = buildFinanceLensPlan(canonicalLens);
  const questions: DiscoveryQuestion[] = [
    buildFinanceTripleRatingQuestion(canonicalLens, plan, profile),
    ...plan.exploratory.map((entry) => ({
      id: nanoid(8),
      text: wrapFinanceExploratoryQuestion(entry.buildQuestion(profile), entry.tag),
      tag: entry.tag,
      purpose: entry.purpose,
      isEdited: false,
    })),
  ];

  return {
    key: canonicalLens,
    label: canonicalLens,
    questions,
  };
}

export function buildContextualFinanceDiscoveryQuestionSet(
  lensNames: string[],
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  rationale: string,
  direction?: string | null,
): DiscoveryQuestionSet {
  return {
    lenses: lensNames.map((lens) => buildContextualFinanceDiscoveryLensQuestions(lens, context, research)),
    generatedAtMs: Date.now(),
    agentRationale: rationale,
    facilitatorDirection: direction || null,
  };
}

function interpolateOperationsScaleLevels(level1: string, level3: string, level5: string): string[] {
  return [
    level1,
    'Some stronger operational signals exist, but they remain inconsistent and unreliable across day-to-day work.',
    level3,
    'Operational improvements are visible in several areas, but execution is not yet consistent enough to rely on end to end.',
    level5,
  ];
}

function buildOperationsTripleRatingScale(
  lens: string,
  signal: OperationsDiscoverySignal,
  profile: OperationsContextProfile,
): string[] {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Operations lens for maturity scale: ${lens}`);
  }

  const scales: Record<CanonicalLensName, Record<string, [string, string, string]>> = {
    People: {
      clarity_gap: [
        `People do not have enough clarity to keep ${profile.serviceFlowFocus} stable under pressure.`,
        `Some teams have clearer roles and support, but day-to-day execution still depends too much on local workarounds.`,
        `People have enough clarity and support that work flows consistently through ${profile.serviceFlowFocus}.`,
      ],
      capacity_pressure: [
        `Workload pressure regularly overwhelms the team and breaks execution reliability.`,
        `Capacity pressure is manageable in some areas, but it still causes visible instability in queues and handoffs.`,
        `Capacity is balanced well enough that day-to-day execution stays stable through normal demand swings.`,
      ],
      capability_gap: [
        `Capability gaps regularly create avoidable errors, escalations, or delays in ${profile.operationalFocus}.`,
        `Some capability gaps are understood, but they still weaken consistency in important parts of the workflow.`,
        `Capability is strong enough that work moves cleanly without avoidable breakdowns.`,
      ],
      handoff_behaviour: [
        `Day-to-day behaviours around handoffs repeatedly create confusion, delay, or dropped work.`,
        `Some handoff behaviours are improving, but inconsistency still weakens operational flow.`,
        `People behaviours around handoffs consistently support reliable execution.`,
      ],
      support_strength: [
        `People do not get the support they need to keep execution stable when things go wrong.`,
        `Support is available in parts of the operation, but gaps still create avoidable friction during busy periods.`,
        `Teams are supported well enough to recover quickly and keep work moving reliably.`,
      ],
    },
    Operations: {
      bottleneck: [
        `Bottlenecks repeatedly stall ${profile.serviceFlowFocus} and create visible delay or queue growth.`,
        `Some bottlenecks are known, but they still cause repeat disruption in the workflow.`,
        `The main workflow moves reliably with only limited and manageable bottlenecks.`,
      ],
      handoff_friction: [
        `Handoffs across ${profile.serviceFlowFocus} are frequent sources of delay, error, or dropped work.`,
        `Some handoffs are improving, but friction still weakens end-to-end reliability.`,
        `Handoffs are clean enough that work moves through the operation without avoidable interruption.`,
      ],
      rework: [
        `Rework is common enough that effort is repeatedly wasted across the operation.`,
        `Some rework has been reduced, but it still consumes too much effort in key areas.`,
        `Rework is low enough that most effort creates clean progress first time through.`,
      ],
      decision_delay: [
        `Operational decisions take too long and repeatedly slow the flow of work.`,
        `Some decisions move faster, but delay still weakens execution in visible ways.`,
        `Decision flow is clear enough that day-to-day work does not stall unnecessarily.`,
      ],
      flow_reliability: [
        `${profile.serviceFlowFocus} is too unstable to deliver consistently without manual intervention.`,
        `Some parts of the workflow are reliable, but instability still appears too often in live operations.`,
        `Flow is reliable enough that the operation can sustain consistent delivery without constant firefighting.`,
      ],
    },
    Technology: {
      tool_friction: [
        `${profile.technologyFocus} create regular friction that slows or complicates execution.`,
        `Some tooling is fit for purpose, but friction still appears too often in important tasks.`,
        `Tools support execution well enough that they reduce rather than create avoidable operational drag.`,
      ],
      system_failure: [
        `System instability or failure repeatedly disrupts the operation.`,
        `Some failures are contained, but reliability still breaks often enough to damage execution flow.`,
        `Systems are reliable enough that outages and instability no longer distort day-to-day work materially.`,
      ],
      data_gap: [
        `Missing or poor-quality data regularly causes delay, confusion, or repeat work.`,
        `Some data gaps are understood, but they still weaken execution consistency in key points of the workflow.`,
        `Data is clear enough that teams can execute without frequent delay or workaround.`,
      ],
      workaround_dependency: [
        `Manual workarounds are relied on so heavily that the operation cannot run cleanly without them.`,
        `Some workarounds are manageable, but dependency on them still creates fragility in execution.`,
        `Workarounds are limited enough that the operational model does not depend on them to stay stable.`,
      ],
      automation_support: [
        `Automation is too weak or inconsistent to remove meaningful pressure from live operations.`,
        `Some automation helps, but operational benefit is still uneven and incomplete.`,
        `Automation supports the operation well enough to reduce avoidable manual effort and delay.`,
      ],
    },
    Commercial: {
      service_pain: [
        `${profile.customerImpactFocus} is being weakened regularly by operational breakdowns.`,
        `Some service pain has been reduced, but customers still feel too much inconsistency in key moments.`,
        `Operational performance supports a customer experience that feels reliable and credible.`,
      ],
      expectation_gap: [
        `Customer expectations are frequently missed because the operation cannot deliver as cleanly as promised.`,
        `Some expectation gaps are understood, but they still appear too often in live service delivery.`,
        `Customer expectations and operational reality are aligned closely enough that trust is maintained.`,
      ],
      value_breakdown: [
        `Value is regularly weakened because operational friction gets in the way of clean delivery.`,
        `Some value loss has been contained, but operational issues still reduce what customers feel they receive.`,
        `Operational performance supports value delivery consistently enough that customers feel the intended benefit.`,
      ],
      customer_delay: [
        `Customers experience visible delay often enough that it undermines confidence in the service.`,
        `Some customer delay has improved, but it still shows up too often in important journeys.`,
        `Customer-facing delay is low enough that service feels responsive and reliable.`,
      ],
      confidence_signal: [
        `Operational instability regularly weakens customer confidence in the service.`,
        `Some strong confidence signals exist, but inconsistency still damages trust in important moments.`,
        `Customers receive enough operational consistency that trust is strengthened rather than weakened.`,
      ],
    },
    Customer: {
      service_pain: [
        `${profile.customerImpactFocus} still creates too much friction in the lived customer experience.`,
        `Some customer pain has been reduced, but too much inconsistency still shows up in key journeys.`,
        `The lived customer experience feels reliable enough that operational performance strengthens trust rather than weakening it.`,
      ],
      expectation_gap: [
        `Customers are still experiencing a gap between what they expect and what the operation can reliably deliver.`,
        `Some expectation gaps are understood, but they still appear too often in live service moments.`,
        `Customer expectations and lived experience are aligned closely enough that confidence is protected.`,
      ],
      value_breakdown: [
        `Operational friction still gets in the way of customers feeling the value they were meant to receive.`,
        `Some value loss has been reduced, but too many customer moments still feel harder than they should.`,
        `Customers receive the intended value consistently enough that service feels dependable and worthwhile.`,
      ],
      customer_delay: [
        `Customers still experience enough delay or chasing that confidence in the service is weakened.`,
        `Some customer delay has improved, but it still appears too often in important journeys.`,
        `Customer-facing delay is low enough that the service feels responsive and under control.`,
      ],
      confidence_signal: [
        `The lived experience still gives customers too many reasons to doubt the service.`,
        `Some strong confidence signals exist, but inconsistency still damages trust in important moments.`,
        `Customers receive enough consistency, clarity, and recovery that trust is strengthened over time.`,
      ],
    },
    'Risk/Compliance': {
      approval_delay: [
        `${profile.controlFocus} create approval delay that repeatedly slows the flow of work.`,
        `Some approvals move well, but delay still appears too often in operationally important points.`,
        `Approvals are proportionate enough that they protect the service without stalling work unnecessarily.`,
      ],
      control_friction: [
        `Controls add enough friction that they regularly weaken operational flow.`,
        `Some controls are well designed, but others still create avoidable execution drag.`,
        `Controls are designed well enough that they protect quality without breaking the workflow.`,
      ],
      policy_ambiguity: [
        `Policy ambiguity regularly creates hesitation, inconsistency, or repeat clarification work.`,
        `Some policy interpretation is clearer, but ambiguity still weakens execution in key scenarios.`,
        `Policies are clear enough that teams can execute consistently without repeated confusion.`,
      ],
      compliance_breakdown: [
        `Compliance work breaks down often enough to create risk or operational instability.`,
        `Some compliance failures are contained, but repeat weaknesses still create visible disruption.`,
        `Compliance is strong enough that it supports rather than destabilises day-to-day delivery.`,
      ],
      assurance_strength: [
        `Assurance activity is too weak or too uneven to support stable, auditable delivery reliably.`,
        `Some assurance is effective, but it is not yet consistent enough across the workflow.`,
        `Assurance is strong enough that quality and auditability are protected without avoidable drag.`,
      ],
    },
    Partners: {
      dependency_delay: [
        `${profile.partnerFocus} create delays that repeatedly weaken execution reliability.`,
        `Some dependencies are manageable, but delays still show up too often in live work.`,
        `External dependencies are responsive enough that they do not materially weaken operational flow.`,
      ],
      partner_handoff_gap: [
        `Third-party handoffs repeatedly create confusion, wait time, or dropped work.`,
        `Some external handoffs are improving, but gaps still weaken end-to-end delivery.`,
        `Partner handoffs are clear enough that external dependencies do not break the workflow.`,
      ],
      responsiveness_issue: [
        `External responsiveness is too inconsistent to support stable day-to-day execution.`,
        `Some suppliers respond well, but inconsistency still creates friction in key moments.`,
        `External responsiveness is strong enough that supplier dependence does not weaken live service delivery.`,
      ],
      accountability_gap: [
        `External accountability is unclear enough that issues bounce around without clean resolution.`,
        `Some accountability is explicit, but gaps still slow issue resolution and recovery.`,
        `Accountability across external dependencies is clear enough that operational issues get resolved cleanly.`,
      ],
      partner_support: [
        `External partners do not yet support the operation strongly enough in the moments that matter most.`,
        `Some partner support is reliable, but coverage is still uneven across the workflow.`,
        `Partners support the operation well enough that they strengthen rather than weaken delivery reliability.`,
      ],
    },
  };

  return interpolateOperationsScaleLevels(...scales[canonicalLens][signal]);
}

function buildOperationsLensPlan(lens: string): OperationsLensPlan {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Operations lens: ${lens}`);
  }

  const plans: Record<CanonicalLensName, OperationsLensPlan> = {
    People: {
      tripleSignal: 'clarity_gap',
      tripleFocus: 'whether people clarity and support are strong enough for reliable execution',
      exploratory: [
        {
          signal: 'capacity_pressure',
          tag: 'pain_points',
          purpose: 'Reveal where workload pressure is destabilising execution.',
          buildQuestion: (profile) => `Where do you see workload pressure making ${profile.serviceFlowFocus} harder to keep stable?`,
        },
        {
          signal: 'capability_gap',
          tag: 'gaps',
          purpose: 'Identify capability gaps that create errors or delay.',
          buildQuestion: (profile) => `Where do you see capability gaps creating avoidable delay or mistakes in ${profile.operationalFocus}?`,
        },
        {
          signal: 'handoff_behaviour',
          tag: 'constraint',
          purpose: 'Surface behaviours that weaken handoff quality.',
          buildQuestion: (profile) => `Where do you see handoff behaviour making work harder to move cleanly through ${profile.serviceFlowFocus}?`,
        },
        {
          signal: 'support_strength',
          tag: 'working',
          purpose: 'Show what support patterns already strengthen execution.',
          buildQuestion: (profile) => `What happens in the parts of the operation where people feel supported enough to keep work moving reliably?`,
        },
      ],
    },
    Operations: {
      tripleSignal: 'flow_reliability',
      tripleFocus: 'how reliable the end-to-end flow is in day-to-day operations',
      exploratory: [
        {
          signal: 'bottleneck',
          tag: 'gaps',
          purpose: 'Reveal the main stall points in the workflow.',
          buildQuestion: (profile) => `Where do you see the biggest bottlenecks in ${profile.serviceFlowFocus} today?`,
        },
        {
          signal: 'handoff_friction',
          tag: 'constraint',
          purpose: 'Identify where work gets lost or slowed between teams.',
          buildQuestion: (profile) => `Where do you see handoffs creating the most friction as work moves through ${profile.serviceFlowFocus}?`,
        },
        {
          signal: 'rework',
          tag: 'pain_points',
          purpose: 'Surface where effort is being repeated unnecessarily.',
          buildQuestion: (profile) => `Where do you see work coming back because it did not clear ${profile.serviceFlowFocus} cleanly?`,
        },
        {
          signal: 'decision_delay',
          tag: 'working',
          purpose: 'Show where cleaner decisions already improve flow.',
          buildQuestion: (profile) => `What happens in the areas where quick decisions keep ${profile.serviceFlowFocus} moving well?`,
        },
      ],
    },
    Technology: {
      tripleSignal: 'tool_friction',
      tripleFocus: 'whether tools and systems support clean day-to-day execution',
      exploratory: [
        {
          signal: 'system_failure',
          tag: 'gaps',
          purpose: 'Reveal where instability breaks the workflow.',
          buildQuestion: (profile) => `Where do you see systems failing or slowing often enough to disrupt ${profile.serviceFlowFocus}?`,
        },
        {
          signal: 'data_gap',
          tag: 'constraint',
          purpose: 'Identify where missing data weakens execution.',
          buildQuestion: (profile) => `Where do you see missing or unclear data making it harder to keep work moving cleanly?`,
        },
        {
          signal: 'workaround_dependency',
          tag: 'pain_points',
          purpose: 'Surface where manual workarounds are holding the operation together.',
          buildQuestion: (profile) => `Where do you see manual workarounds doing too much of the work in ${profile.technologyFocus}?`,
        },
        {
          signal: 'automation_support',
          tag: 'working',
          purpose: 'Show where tools already reduce friction well.',
          buildQuestion: (profile) => `What happens in the parts of the operation where systems or automation already remove friction effectively?`,
        },
      ],
    },
    Commercial: {
      tripleSignal: 'service_pain',
      tripleFocus: 'how strongly operational reality is affecting customer and service outcomes',
      exploratory: [
        {
          signal: 'expectation_gap',
          tag: 'gaps',
          purpose: 'Reveal where promises and delivery reality diverge.',
          buildQuestion: (profile) => `Where do customers notice when ${profile.serviceFlowFocus} fails to deliver as expected?`,
        },
        {
          signal: 'customer_delay',
          tag: 'constraint',
          purpose: 'Identify where customers feel delay most directly.',
          buildQuestion: (profile) => `Where do customers feel delay most clearly when ${profile.serviceFlowFocus} slows down?`,
        },
        {
          signal: 'value_breakdown',
          tag: 'pain_points',
          purpose: 'Surface where operational friction weakens value delivery.',
          buildQuestion: (profile) => `Where does operational friction affect the value customers expect from ${profile.customerImpactFocus}?`,
        },
        {
          signal: 'confidence_signal',
          tag: 'working',
          purpose: 'Show where operations already strengthen trust.',
          buildQuestion: (profile) => `What happens in the moments where operational performance most clearly strengthens customer confidence in the service?`,
        },
      ],
    },
    Customer: {
      tripleSignal: 'service_pain',
      tripleFocus: 'how the operation shows up in the lived customer experience',
      exploratory: [
        {
          signal: 'customer_delay',
          tag: 'pain_points',
          purpose: 'Reveal where customers feel delay most clearly.',
          buildQuestion: (profile) => `Where do customers most clearly feel delay or have to chase because ${profile.serviceFlowFocus} is not flowing cleanly?`,
        },
        {
          signal: 'expectation_gap',
          tag: 'gaps',
          purpose: 'Identify where service experience falls short of expectation.',
          buildQuestion: () => `Where does the customer experience fall furthest short of what people expect from this service today?`,
        },
        {
          signal: 'confidence_signal',
          tag: 'constraint',
          purpose: 'Surface where inconsistency weakens trust.',
          buildQuestion: () => `Where does inconsistency in day-to-day delivery do the most damage to customer confidence?`,
        },
        {
          signal: 'value_breakdown',
          tag: 'working',
          purpose: 'Show where the operation already creates a strong customer outcome.',
          buildQuestion: () => `What happens in the parts of the service where customers clearly get the value they expected without unnecessary effort?`,
        },
      ],
    },
    'Risk/Compliance': {
      tripleSignal: 'control_friction',
      tripleFocus: 'how much controls and approvals are helping or slowing operational flow',
      exploratory: [
        {
          signal: 'approval_delay',
          tag: 'gaps',
          purpose: 'Reveal where approvals slow work most.',
          buildQuestion: (profile) => `Where do you see approvals slowing work most visibly in ${profile.operationalFocus}?`,
        },
        {
          signal: 'policy_ambiguity',
          tag: 'constraint',
          purpose: 'Identify where unclear policy creates hesitation or inconsistency.',
          buildQuestion: (profile) => `Where do you see unclear policy or interpretation making work harder to complete consistently?`,
        },
        {
          signal: 'compliance_breakdown',
          tag: 'pain_points',
          purpose: 'Surface where compliance work breaks down and disrupts operations.',
          buildQuestion: (profile) => `Where do you see compliance work breaking down in ways that create delay, risk, or repeat effort?`,
        },
        {
          signal: 'assurance_strength',
          tag: 'working',
          purpose: 'Show where controls already help keep work clean.',
          buildQuestion: (profile) => `What happens in the areas where checks and controls already help work move cleanly without creating too much drag?`,
        },
      ],
    },
    Partners: {
      tripleSignal: 'dependency_delay',
      tripleFocus: 'how much external dependencies are affecting operational reliability',
      exploratory: [
        {
          signal: 'partner_handoff_gap',
          tag: 'gaps',
          purpose: 'Reveal where third-party handoffs break the flow.',
          buildQuestion: (profile) => `Where do you see third-party handoffs creating the biggest gaps in ${profile.serviceFlowFocus}?`,
        },
        {
          signal: 'responsiveness_issue',
          tag: 'constraint',
          purpose: 'Identify where external response times weaken delivery.',
          buildQuestion: (profile) => `Where do you see partner or supplier responsiveness slowing work down most?`,
        },
        {
          signal: 'accountability_gap',
          tag: 'pain_points',
          purpose: 'Surface where issues bounce because external accountability is unclear.',
          buildQuestion: (profile) => `Where do you see issues bouncing around because accountability is unclear across ${profile.partnerFocus}?`,
        },
        {
          signal: 'partner_support',
          tag: 'working',
          purpose: 'Show where external dependencies already support clean delivery.',
          buildQuestion: (profile) => `What happens in the parts of the workflow where external partners already support delivery reliably?`,
        },
      ],
    },
  };

  return plans[canonicalLens];
}

function buildOperationsTripleRatingQuestion(
  lens: string,
  plan: OperationsLensPlan,
  profile: OperationsContextProfile,
): DiscoveryQuestion {
  return {
    id: nanoid(8),
    text: `Based on what you see in day-to-day work, where is ${plan.tripleFocus} today, where should it be, and where will it end up if nothing changes?`,
    tag: 'triple_rating',
    maturityScale: buildOperationsTripleRatingScale(lens, plan.tripleSignal, profile),
    purpose: `Assess the current, target, and projected state of ${plan.tripleFocus} in live operations.`,
    isEdited: false,
  };
}

function buildContextualOperationsDiscoveryLensQuestions(
  lens: string,
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): DiscoveryLensQuestions {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Operations lens: ${lens}`);
  }

  const profile = buildOperationsContextProfile(context, research);
  const plan = buildOperationsLensPlan(canonicalLens);
  const questions: DiscoveryQuestion[] = [
    buildOperationsTripleRatingQuestion(canonicalLens, plan, profile),
    ...plan.exploratory.map((entry) => ({
      id: nanoid(8),
      text: wrapOperationsExploratoryQuestion(entry.buildQuestion(profile), entry.tag),
      tag: entry.tag,
      purpose: entry.purpose,
      isEdited: false,
    })),
  ];

  return {
    key: canonicalLens,
    label: canonicalLens,
    questions,
  };
}

export function buildContextualOperationsDiscoveryQuestionSet(
  lensNames: string[],
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  rationale: string,
  direction?: string | null,
): DiscoveryQuestionSet {
  return {
    lenses: lensNames.map((lens) => buildContextualOperationsDiscoveryLensQuestions(lens, context, research)),
    generatedAtMs: Date.now(),
    agentRationale: rationale,
    facilitatorDirection: direction || null,
  };
}

function interpolateTransformationScaleLevels(level1: string, level3: string, level5: string): string[] {
  return [
    level1,
    'Some change signals are positive, but they remain inconsistent and unreliable across the current model.',
    level3,
    'Stronger change conditions are visible in several areas, but they are not yet consistent enough to support the future state at scale.',
    level5,
  ];
}

function buildTransformationTripleRatingScale(
  lens: string,
  signal: TransformationDiscoverySignal,
  profile: TransformationContextProfile,
): string[] {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Transformation lens for maturity scale: ${lens}`);
  }

  const scales: Record<CanonicalLensName, Record<string, [string, string, string]>> = {
    People: {
      change_readiness: [
        `People do not trust the change story enough to move toward ${profile.futureStateFocus}.`,
        `Some teams are ready to change, but readiness is uneven and the target state still feels abstract.`,
        `People understand the change well enough to move toward ${profile.futureStateFocus} with confidence.`,
      ],
      credibility_gap: [
        `Leadership ambition for ${profile.futureStateFocus} is not credible in day-to-day reality.`,
        `The direction is understood, but credibility breaks down when teams compare it with current reality.`,
        `The change story is credible enough that teams believe the future state can be delivered.`,
      ],
      behavioural_friction: [
        `Current behaviours repeatedly pull work back toward the existing model.`,
        `Some behaviours are shifting, but old habits still distort the move to the target state.`,
        `Day-to-day behaviours increasingly support the way ${profile.futureStateFocus} needs to work.`,
      ],
      capability_gap: [
        `Critical capabilities needed for ${profile.futureStateFocus} are missing or too thin to rely on.`,
        `Some capability gaps are understood, but they still threaten the pace and credibility of change.`,
        `Capability is strong enough that the future state can be delivered without depending on isolated heroics.`,
      ],
      fatigue_risk: [
        `Change fatigue is high enough that another major shift would likely stall or distort.`,
        `Fatigue is visible in parts of the organisation, but it is not yet overwhelming the change effort.`,
        `The organisation has enough energy and trust to absorb the required change without breaking momentum.`,
      ],
    },
    Operations: {
      operating_model_gap: [
        `${profile.operatingAnchor} cannot support ${profile.futureStateFocus} without fundamental redesign.`,
        `Some parts of the current model can support the target state, but key gaps still make change fragile.`,
        `The current model has evolved enough that the future state is operationally credible.`,
      ],
      handoff_friction: [
        `Current handoffs repeatedly break the flow that the future state would depend on.`,
        `Some handoffs are improving, but the operating flow still creates too much drag for the target state.`,
        `Handoffs are reliable enough that the future state could work end to end in practice.`,
      ],
      decision_delay: [
        `Decision flow is too slow and fragmented to support the pace of transformation required.`,
        `Some decisions move faster, but the current model still creates material delay at key points.`,
        `Decision flow is clear enough that the future state can move without avoidable stall points.`,
      ],
      execution_dependency: [
        `The target state depends on too many fragile execution dependencies in the current model.`,
        `Some dependencies are understood, but they are still likely to slow or distort the change path.`,
        `Execution dependencies are explicit and manageable enough to support a sequenced transformation.`,
      ],
      scaling_blocker: [
        `The current operating model cannot scale into the target state without creating new failure points.`,
        `Some scaling blockers are visible and partly managed, but the path to scale is still unstable.`,
        `The operating model is robust enough that the target state could scale with controlled risk.`,
      ],
    },
    Technology: {
      architecture_constraint: [
        `${profile.technologyAnchor} materially limits what can change and how quickly it can land.`,
        `Some architecture constraints are manageable, but the current stack still slows the future-state path.`,
        `Technology architecture is flexible enough to support the target state without avoidable redesign churn.`,
      ],
      data_gap: [
        `Data quality, structure, or accessibility is too weak to support ${profile.futureStateFocus} credibly.`,
        `Some data foundations are in place, but gaps still weaken the transformation case in key areas.`,
        `Data is strong enough to support the target state with confidence and control.`,
      ],
      integration_dependency: [
        `Critical integrations are too fragile or incomplete to support the target state reliably.`,
        `Some integration risks are understood, but they still threaten transformation timing and stability.`,
        `Integration dependencies are managed well enough to support the future state end to end.`,
      ],
      technology_enabler: [
        `Current technology is mostly a constraint rather than an enabler of ${profile.futureStateFocus}.`,
        `Some enabling capability exists, but it is not yet broad or stable enough to carry the change.`,
        `Technology is a credible enabler of the future state rather than a brake on it.`,
      ],
      change_complexity: [
        `Technology change complexity is too high to support the target state at the required pace.`,
        `Some complexity is understood, but it still threatens sequencing and confidence in delivery.`,
        `Technology change complexity is contained well enough that the transformation path is credible.`,
      ],
    },
    Commercial: {
      market_pressure: [
        `${profile.marketAnchor} are creating transformation pressure faster than the current model can absorb.`,
        `Market pressure is visible, but the organisation is still inconsistent in how it responds to it.`,
        `Commercial pressure is understood clearly enough to focus the transformation in the right direction.`,
      ],
      promise_gap: [
        `There is a visible gap between what is being promised and what the current model can support today.`,
        `Some promise gaps are understood, but they still create tension around the target state.`,
        `Customer and market promises are aligned tightly enough that the future state feels commercially credible.`,
      ],
      customer_expectation_risk: [
        `Customer expectations are moving faster than the current model and could destabilise the change path.`,
        `Some expectation risk is understood, but it still creates ambiguity about what must change first.`,
        `Customer expectations are clear enough to sharpen the transformation priorities rather than blur them.`,
      ],
      growth_dependency: [
        `Growth goals depend on change the current model is not yet ready to support.`,
        `Some growth dependencies are visible, but they still create uncertainty in the transformation case.`,
        `Growth ambitions are grounded enough that the transformation path can be sequenced credibly.`,
      ],
      commercial_tradeoff: [
        `Commercial commitments are forcing trade-offs that keep the business trapped in the current model.`,
        `Some trade-offs are being managed, but they still weaken the target-state path.`,
        `Commercial trade-offs are explicit enough that the future state can be prioritised with discipline.`,
      ],
    },
    Customer: {
      journey_breakdown: [
        `Current customer journeys break down often enough that ${profile.futureStateFocus} would not feel real externally.`,
        `Some customer journey issues are known, but they still create too much friction for the target state to feel credible.`,
        `Customer journeys are stable enough that the future state could be felt clearly by customers rather than just described internally.`,
      ],
      trust_gap: [
        `Customer trust is too weak or too inconsistent for the target state to land credibly.`,
        `Some trust is present, but current experience still creates doubt in important customer moments.`,
        `Customer trust is strong enough that the future-state ambition would feel believable in practice.`,
      ],
      customer_effort: [
        `Customers still have to work too hard to get value from the current model.`,
        `Some effort has been reduced, but key journeys still ask too much of customers today.`,
        `Customer effort is low enough that the future state could build from a credible experience base.`,
      ],
      service_failure: [
        `Service failures still show up often enough that they undermine the case for change.`,
        `Some service failure patterns are understood, but they still distort what the target state must solve first.`,
        `Service failures are contained enough that the transformation can focus on deliberate improvement rather than constant recovery.`,
      ],
      experience_expectation_gap: [
        `There is still a material gap between what customers expect and what the current model delivers.`,
        `Some expectation gaps are visible, but they still blur what the future state must fix first.`,
        `Customer expectations are explicit enough that they sharpen the transformation priorities rather than confuse them.`,
      ],
    },
    'Risk/Compliance': {
      approval_friction: [
        `${profile.governanceAnchor} create approval drag that will slow the target state materially.`,
        `Some approval friction is manageable, but it still threatens the pace of transformation.`,
        `Approval flow is disciplined enough to protect the business without stalling the change.`,
      ],
      governance_drag: [
        `Current governance adds too much drag to let ${profile.futureStateFocus} move at the right pace.`,
        `Governance is partly aligned to change, but key decisions still move too slowly or ambiguously.`,
        `Governance supports transformation pace without losing control or assurance.`,
      ],
      control_dependency: [
        `Controls are so tightly tied to the current model that they make the target state hard to land.`,
        `Some controls can evolve, but important dependencies still make change slow and fragile.`,
        `Controls can adapt with the transformation without undermining assurance.`,
      ],
      risk_constraint: [
        `Risk posture is constraining change more than it is enabling a controlled transformation.`,
        `Some risks are well managed, but risk treatment still weakens the credibility of the change path.`,
        `Risk is being managed in a way that protects the business while still allowing the target state to land.`,
      ],
      assurance_requirement: [
        `Assurance requirements are heavy enough that they could distort the sequencing of change.`,
        `Some assurance needs are clear, but they still create avoidable drag in the transformation path.`,
        `Assurance requirements are explicit enough that they can be built into the change path without derailing it.`,
      ],
    },
    Partners: {
      external_dependency: [
        `${profile.partnerAnchor} are too strong or too unclear for ${profile.futureStateFocus} to land cleanly.`,
        `Some external dependencies are understood, but they still create uncertainty in the change path.`,
        `External dependencies are explicit enough that the future state can be planned and sequenced around them.`,
      ],
      partner_constraint: [
        `Vendors or partners are constraining what can change and how quickly it can move.`,
        `Some partner constraints are manageable, but they still weaken the credibility of the transformation pace.`,
        `Partner constraints are visible and manageable enough that they do not derail the target state.`,
      ],
      delivery_risk: [
        `External delivery dependencies could break or slow the move to ${profile.futureStateFocus}.`,
        `Some external delivery risk is understood, but it still threatens key parts of the change path.`,
        `External delivery risk is controlled well enough to support the transformation sequence.`,
      ],
      alignment_gap: [
        `Partners are not aligned tightly enough to the target state to support the change cleanly.`,
        `Some partner alignment exists, but key external players are still working to a different reality.`,
        `Partners are aligned enough to the target state that they can support rather than distort it.`,
      ],
      acceleration_opportunity: [
        `The business is not yet using external partners to accelerate the change where it could.`,
        `Some acceleration opportunities exist, but they are not yet being used consistently.`,
        `External partners are being used selectively and credibly to accelerate the transformation path.`,
      ],
    },
  };

  return interpolateTransformationScaleLevels(...scales[canonicalLens][signal]);
}

function buildTransformationLensPlan(lens: string): TransformationLensPlan {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Transformation lens: ${lens}`);
  }

  const plans: Record<CanonicalLensName, TransformationLensPlan> = {
    People: {
      tripleSignal: 'change_readiness',
      tripleFocus: 'people readiness for the target state',
      exploratory: [
        {
          signal: 'credibility_gap',
          tag: 'gaps',
          purpose: 'Reveal where the change story is not credible in lived reality.',
          buildQuestion: (profile) => `Where do you see credibility concerns making teams doubt the move to ${profile.futureStateFocus} is real?`,
        },
        {
          signal: 'behavioural_friction',
          tag: 'constraint',
          purpose: 'Surface behaviours that keep work anchored in the current model.',
          buildQuestion: (profile) => `Where do you see current behaviours pulling work back toward the old model instead of supporting ${profile.futureStateFocus}?`,
        },
        {
          signal: 'capability_gap',
          tag: 'pain_points',
          purpose: 'Identify capability gaps that weaken the change path.',
          buildQuestion: (profile) => `Where do you see capability gaps that would make ${profile.futureStateFocus} hard to land credibly?`,
        },
        {
          signal: 'fatigue_risk',
          tag: 'working',
          purpose: 'Surface whether energy and trust are strong enough to absorb change.',
          buildQuestion: (profile) => `Where do you see fatigue starting to weaken the move toward ${profile.futureStateFocus}?`,
        },
      ],
    },
    Operations: {
      tripleSignal: 'operating_model_gap',
      tripleFocus: 'how far the current operating model can support the target state',
      exploratory: [
        {
          signal: 'handoff_friction',
          tag: 'gaps',
          purpose: 'Reveal where the current handoff model breaks the target-state logic.',
          buildQuestion: (profile) => `Where do you see current handoffs making ${profile.futureStateFocus} hard to run in practice?`,
        },
        {
          signal: 'decision_delay',
          tag: 'constraint',
          purpose: 'Surface where decision flow slows the transformation path.',
          buildQuestion: (profile) => `Where do you see decision flow slowing the move toward ${profile.futureStateFocus}?`,
        },
        {
          signal: 'execution_dependency',
          tag: 'pain_points',
          purpose: 'Identify fragile dependencies in the current model.',
          buildQuestion: (profile) => `Where do you see execution dependencies and fragile handoffs making the path to ${profile.futureStateFocus} unreliable?`,
        },
        {
          signal: 'scaling_blocker',
          tag: 'working',
          purpose: 'Show where operating conditions already support the target state.',
          buildQuestion: (profile) => `What happens in the parts of the operating model that already work the way ${profile.futureStateFocus} requires?`,
        },
      ],
    },
    Technology: {
      tripleSignal: 'architecture_constraint',
      tripleFocus: 'whether the current technology landscape can support the future state',
      exploratory: [
        {
          signal: 'data_gap',
          tag: 'gaps',
          purpose: 'Reveal data limitations that weaken the future-state path.',
          buildQuestion: (profile) => `Where do you see data gaps making ${profile.futureStateFocus} harder to deliver with confidence?`,
        },
        {
          signal: 'integration_dependency',
          tag: 'constraint',
          purpose: 'Surface the integration dependencies that slow change.',
          buildQuestion: (profile) => `Where do you see integrations or system dependencies making the path to ${profile.futureStateFocus} more fragile or slower?`,
        },
        {
          signal: 'change_complexity',
          tag: 'pain_points',
          purpose: 'Show where technology complexity could distort sequencing.',
          buildQuestion: (profile) => `Where does the current technology complexity make it hardest to sequence the move toward ${profile.futureStateFocus}?`,
        },
        {
          signal: 'technology_enabler',
          tag: 'working',
          purpose: 'Identify where the technology base already supports transformation.',
          buildQuestion: (profile) => `What happens in the technology areas that already make ${profile.futureStateFocus} feel more realistic?`,
        },
      ],
    },
    Commercial: {
      tripleSignal: 'promise_gap',
      tripleFocus: 'how far customer and market commitments are aligned to the target state',
      exploratory: [
        {
          signal: 'market_pressure',
          tag: 'gaps',
          purpose: 'Reveal external pressure driving the need for change.',
          buildQuestion: (profile) => `Where do you see customer or market pressure making it clear that the current model cannot hold for much longer?`,
        },
        {
          signal: 'customer_expectation_risk',
          tag: 'constraint',
          purpose: 'Show where expectations are moving faster than the business can change.',
          buildQuestion: (profile) => `Where do you see customer expectations moving faster than the business can currently change toward ${profile.futureStateFocus}?`,
        },
        {
          signal: 'growth_dependency',
          tag: 'pain_points',
          purpose: 'Identify growth ambitions that depend on transformation.',
          buildQuestion: (profile) => `Where do you see growth plans depending on changes the current model is not yet ready to support?`,
        },
        {
          signal: 'commercial_tradeoff',
          tag: 'working',
          purpose: 'Surface where commercial priorities are already helping focus change.',
          buildQuestion: (profile) => `What happens in the areas where customer promises and growth priorities are already helping the room focus on the right change?`,
        },
      ],
    },
    Customer: {
      tripleSignal: 'journey_breakdown',
      tripleFocus: 'how clearly customers would feel the future state versus today’s broken journey',
      exploratory: [
        {
          signal: 'experience_expectation_gap',
          tag: 'gaps',
          purpose: 'Reveal where the current experience falls shortest against expectation.',
          buildQuestion: () => `Where do customers feel the biggest gap today between what they expect and what the current model actually gives them?`,
        },
        {
          signal: 'customer_effort',
          tag: 'pain_points',
          purpose: 'Surface where customers work too hard in the current model.',
          buildQuestion: () => `Where in the current journey do customers have to work too hard just to get the outcome they expected?`,
        },
        {
          signal: 'trust_gap',
          tag: 'constraint',
          purpose: 'Identify where trust has to be rebuilt for the future state to land.',
          buildQuestion: () => `Where has the current experience weakened customer trust enough that the future state would need to rebuild it deliberately?`,
        },
        {
          signal: 'service_failure',
          tag: 'working',
          purpose: 'Show where the current experience already supports the target state.',
          buildQuestion: (profile) => `What happens in the parts of the customer journey that already feel closest to the experience ${profile.futureStateFocus} is meant to create?`,
        },
      ],
    },
    'Risk/Compliance': {
      tripleSignal: 'governance_drag',
      tripleFocus: 'how much governance and control will slow or support the transformation path',
      exploratory: [
        {
          signal: 'approval_friction',
          tag: 'gaps',
          purpose: 'Reveal approval bottlenecks that weaken transformation pace.',
          buildQuestion: (profile) => `Where do you see approvals slowing change enough to put ${profile.futureStateFocus} at risk?`,
        },
        {
          signal: 'control_dependency',
          tag: 'constraint',
          purpose: 'Show where current controls are too tied to the old model.',
          buildQuestion: (profile) => `Where do you see current controls making it difficult to move from the existing model toward ${profile.futureStateFocus}?`,
        },
        {
          signal: 'assurance_requirement',
          tag: 'pain_points',
          purpose: 'Identify assurance requirements that could distort sequencing.',
          buildQuestion: (profile) => `Where do you see assurance requirements forcing the change path to move more slowly than the target state needs?`,
        },
        {
          signal: 'risk_constraint',
          tag: 'working',
          purpose: 'Surface where control and pace are already balanced well.',
          buildQuestion: (profile) => `What happens where risk and control are already helping the path toward ${profile.futureStateFocus}?`,
        },
      ],
    },
    Partners: {
      tripleSignal: 'external_dependency',
      tripleFocus: 'how much external dependency shapes whether the future state can land',
      exploratory: [
        {
          signal: 'partner_constraint',
          tag: 'gaps',
          purpose: 'Reveal where vendors or partners are constraining the change.',
          buildQuestion: (profile) => `Where do you see vendors or partners limiting how quickly ${profile.futureStateFocus} could realistically move?`,
        },
        {
          signal: 'delivery_risk',
          tag: 'constraint',
          purpose: 'Show where third-party delivery dependencies make change fragile.',
          buildQuestion: (profile) => `Where do you see external delivery dependencies making the path to ${profile.futureStateFocus} more fragile?`,
        },
        {
          signal: 'alignment_gap',
          tag: 'pain_points',
          purpose: 'Identify where partners are working to a different reality from the target state.',
          buildQuestion: (profile) => `Where do you see external partners still working to a different reality from the one ${profile.futureStateFocus} requires?`,
        },
        {
          signal: 'acceleration_opportunity',
          tag: 'working',
          purpose: 'Surface where partners could accelerate the change path.',
          buildQuestion: (profile) => `What happens where external partners are already helping the move toward ${profile.futureStateFocus}?`,
        },
      ],
    },
  };

  return plans[canonicalLens];
}

function buildTransformationTripleRatingQuestion(
  lens: string,
  plan: TransformationLensPlan,
  profile: TransformationContextProfile,
): DiscoveryQuestion {
  return {
    id: nanoid(8),
    text: `Based on what you see in current work today, where is ${plan.tripleFocus}, where should it be for ${profile.futureStateFocus}, and where will it end up if nothing changes?`,
    tag: 'triple_rating',
    maturityScale: buildTransformationTripleRatingScale(lens, plan.tripleSignal, profile),
    purpose: `Assess the current, target, and projected state of ${plan.tripleFocus} against the future-state change path.`,
    isEdited: false,
  };
}

function buildContextualTransformationDiscoveryLensQuestions(
  lens: string,
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): DiscoveryLensQuestions {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported Transformation lens: ${lens}`);
  }

  const profile = buildTransformationContextProfile(context, research);
  const plan = buildTransformationLensPlan(canonicalLens);
  const questions: DiscoveryQuestion[] = [
    buildTransformationTripleRatingQuestion(canonicalLens, plan, profile),
    ...plan.exploratory.map((entry) => ({
      id: nanoid(8),
      text: wrapTransformationExploratoryQuestion(entry.buildQuestion(profile), entry.tag),
      tag: entry.tag,
      purpose: entry.purpose,
      isEdited: false,
    })),
  ];

  return {
    key: canonicalLens,
    label: canonicalLens,
    questions,
  };
}

export function buildContextualTransformationDiscoveryQuestionSet(
  lensNames: string[],
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  rationale: string,
  direction?: string | null,
): DiscoveryQuestionSet {
  return {
    lenses: lensNames.map((lens) => buildContextualTransformationDiscoveryLensQuestions(lens, context, research)),
    generatedAtMs: Date.now(),
    agentRationale: rationale,
    facilitatorDirection: direction || null,
  };
}

function buildGtmTripleRatingScale(
  lens: string,
  signal: GtmDiscoverySignal,
  profile: GtmContextProfile,
): string[] {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported GTM lens for maturity scale: ${lens}`);
  }

  const customScales: Record<CanonicalLensName, Record<GtmDiscoverySignal, [string, string, string]>> = {
    People: {
      win_pattern: [
        `Buyer-facing teams tell different stories about ${profile.propositionFocus}, so trust depends on individuals and weaker pursuits drift.`,
        `Some teams can land ${profile.propositionFocus} credibly, but the story is inconsistent across deals and segments.`,
        `Teams present one credible commercial story that helps ${profile.company} win the right work more repeatably.`,
      ],
      misalignment: [
        `Handoffs across commercial, solution, and delivery teams weaken buyer confidence before deals are secured.`,
        `Some pursuits stay aligned, but cross-team inconsistency still damages confidence in complex opportunities.`,
        `Cross-team alignment consistently reinforces buyer trust from first conversation through commitment.`,
      ],
      constraint: [
        `Team capability regularly limits which opportunities ${profile.company} can pursue credibly.`,
        `Capability supports some opportunities, but stronger deals still depend on a small number of people.`,
        `Capability is broad enough that ${profile.company} can pursue target work without depending on heroics.`,
      ],
      loss_pattern: [
        `Losses repeatedly trace back to buyer-facing inconsistency and weak proposition credibility.`,
        `Some loss drivers are understood, but the same people-driven breakdowns still recur in important deals.`,
        `People-driven loss patterns are visible early and corrected before they keep repeating.`,
      ],
      differentiation: [
        `People rarely strengthen the commercial case enough to separate ${profile.company} from alternatives.`,
        `Some teams create differentiation in live pursuits, but it is not yet consistent across target deals.`,
        `Buyer-facing teams consistently make ${profile.company} feel more credible and differentiated in the right opportunities.`,
      ],
      ICP: [``, ``, ``],
      anti_ICP: [``, ``, ``],
      fragility: [``, ``, ``],
    },
    Operations: {
      constraint: [
        `Delivery limits what can be sold, so target pursuits get qualified late or carried with hidden delivery risk.`,
        `Some work can be sold cleanly, but delivery constraints still narrow which deals are commercially safe.`,
        `Delivery capability clearly supports the work ${profile.company} wants to win and scale.`,
      ],
      misalignment: [
        `What gets sold and what can be delivered regularly diverge, creating reset conversations after the deal is won.`,
        `Some sold promises land cleanly, but misalignment still shows up in important handoffs and scopes.`,
        `Sale and delivery stay aligned tightly enough that commercial promises remain credible after signature.`,
      ],
      fragility: [
        `Won work frequently becomes unstable once it moves into delivery, damaging references and repeatability.`,
        `Fragility shows up only in certain deal types, but the pattern still affects scale and renewability.`,
        `Target deals move into delivery without avoidable breakage or hidden execution risk.`,
      ],
      ICP: [
        `The operation can support only a narrow slice of opportunities, but that boundary is not explicit in pursuit decisions.`,
        `Some high-fit work is understood, though qualification still drifts into marginal deals.`,
        `Operational fit is clear enough that pursuit choices consistently favour scalable, supportable work.`,
      ],
      anti_ICP: [``, ``, ``],
      win_pattern: [``, ``, ``],
      loss_pattern: [``, ``, ``],
      differentiation: [``, ``, ``],
    },
    Technology: {
      differentiation: [
        `Technology claims do not reliably help ${profile.company} separate from ${profile.competitorFocus}.`,
        `Technology helps in some pursuits, but the differentiator is uneven and hard to defend in harder deals.`,
        `Technology is a credible part of why buyers choose ${profile.company} in target opportunities.`,
      ],
      fragility: [
        `Buyers frequently discover gaps between the technical promise and what can actually be delivered.`,
        `Most pursuits hold together, but fragile capability claims still surface in higher-stakes deals.`,
        `Technical claims are specific, credible, and stable enough to support live pursuits without backtracking.`,
      ],
      constraint: [
        `Capability gaps stop ${profile.company} from pursuing work that otherwise fits the commercial ambition.`,
        `Technology supports part of the target market, but visible gaps still narrow the addressable opportunity set.`,
        `Technology capability supports the target market without forcing avoidable concession or overstatement.`,
      ],
      loss_pattern: [
        `Losses repeatedly expose where the technical story is weaker than buyer expectation or competitor proof.`,
        `Some technical loss patterns are visible, but they are not yet understood early enough to change pursuit choices.`,
        `Technology-related loss patterns are understood and addressed before they keep undermining target deals.`,
      ],
      win_pattern: [``, ``, ``],
      misalignment: [``, ``, ``],
      ICP: [``, ``, ``],
      anti_ICP: [``, ``, ``],
    },
    Commercial: {
      ICP: [
        `${profile.company} still wins across a mixed client base without a sharp view of which opportunities best fit ${profile.outcomePrompt}.`,
        `Some strong-fit segments are visible, but pursuit choices still blur together stronger and weaker opportunities.`,
        `${profile.company} can clearly distinguish which buyers and deal types belong in the target growth path.`,
      ],
      anti_ICP: [
        `Weak-fit opportunities still look attractive at sale and consume effort that should go elsewhere.`,
        `Some avoidable work is recognised, but anti-ICP signals are not yet shaping pursuit discipline consistently.`,
        `${profile.company} can spot and avoid weak-fit work before it distorts the pipeline or delivery load.`,
      ],
      win_pattern: [
        `Wins happen, but the commercial pattern behind them is not sharp enough to guide repeatable targeting.`,
        `Some win patterns are understood, but they are not yet being applied consistently across the pipeline.`,
        `Win patterns are clear enough to shape who to pursue, how to position, and where to invest effort.`,
      ],
      loss_pattern: [``, ``, ``],
      fragility: [``, ``, ``],
      constraint: [``, ``, ``],
      differentiation: [``, ``, ``],
      misalignment: [``, ``, ``],
    },
    Customer: {
      ICP: [
        `${profile.company} does not yet understand clearly which customer relationships turn into healthy, repeatable growth after the sale.`,
        `Some strong customer relationship patterns are visible, but they are not yet shaping the business consistently enough.`,
        `${profile.company} can distinguish clearly which customer relationships create long-term trust, retention, and expansion potential.`,
      ],
      anti_ICP: [
        `Some customer relationships look attractive at sale but become too fragile, effort-heavy, or low-trust to keep healthy.`,
        `Some weak-fit customer relationships are recognised, but the pattern still distorts retention and account effort.`,
        `${profile.company} can spot the customer relationships that weaken retention or trust before they absorb more effort.`,
      ],
      win_pattern: [
        `The business does not yet understand clearly what customers value most once they are living with the offer.`,
        `Some post-sale customer value patterns are visible, but they are not yet sharp enough to guide repeatability confidently.`,
        `Customer value patterns are clear enough that the business can reinforce what drives retention, trust, and expansion.`,
      ],
      loss_pattern: [
        `Customer loss still reveals repeat experience problems too late for the business to learn from them consistently.`,
        `Some churn or trust-loss patterns are understood, but they still recur in important accounts.`,
        `Loss patterns are visible early enough that the business can reduce customer churn and trust erosion before they repeat.`,
      ],
      constraint: [
        `The lived customer experience still constrains how credibly ${profile.company} can retain or expand the right accounts.`,
        `Some customer relationships are strong, but experience constraints still weaken renewal or expansion confidence in important areas.`,
        `The customer experience is strong enough that the right accounts can renew, grow, and advocate with confidence.`,
      ],
      misalignment: [
        `What customers were sold and what they then experience still diverge too often after the deal is won.`,
        `Some accounts stay aligned, but the lived experience still diverges from the commercial promise in important moments.`,
        `The lived customer experience aligns closely enough with the promise that trust is reinforced after sale.`,
      ],
      differentiation: [
        `Customers do not yet experience enough after the sale to make ${profile.company} feel meaningfully different.`,
        `Some accounts feel a differentiated experience, but it is not yet consistent enough across target relationships.`,
        `Customers experience a relationship distinct enough to strengthen retention, advocacy, and expansion in the right accounts.`,
      ],
      fragility: [
        `Important customer relationships still become fragile after the sale because trust or experience breaks down.`,
        `Some fragile relationships are known, but they still consume disproportionate effort once live.`,
        `Customer relationships are stable enough after the sale that they do not undermine the growth path.`,
      ],
    },
    'Risk/Compliance': {
      constraint: [
        `${profile.riskFocus} repeatedly slows or blocks target opportunities after pursuit effort is already committed.`,
        `Some deals navigate ${profile.riskFocus} well, but others still become commercially unattractive too late.`,
        `${profile.riskFocus} is understood early enough that deal viability and pursuit speed are not being distorted unnecessarily.`,
      ],
      anti_ICP: [
        `Certain opportunities look attractive commercially but become unworkable once ${profile.riskFocus} is applied.`,
        `Some avoidable risk-heavy opportunities are recognised, but the pattern is not yet disciplined in qualification.`,
        `${profile.company} can distinguish viable target work from opportunities that should be avoided on risk grounds.`,
      ],
      fragility: [
        `Risk and approval issues surface late enough to damage deal confidence or reshape the offer under pressure.`,
        `Late-stage risk surprises happen less often, but they still destabilise important live pursuits.`,
        `Risk and compliance friction are visible early enough to avoid late commercial shock in target deals.`,
      ],
      win_pattern: [``, ``, ``],
      loss_pattern: [``, ``, ``],
      misalignment: [``, ``, ``],
      differentiation: [``, ``, ``],
      ICP: [``, ``, ``],
    },
    Partners: {
      differentiation: [
        `Partner capability rarely strengthens the reason buyers choose ${profile.company} in live pursuits.`,
        `Some partner-backed deals feel stronger, but partner contribution is still uneven across target opportunities.`,
        `Partners consistently make the offer more credible, stronger, or easier to buy in the right deals.`,
      ],
      fragility: [
        `Important pursuits become unstable because partner dependence is not matched to what is being sold.`,
        `Some partner dependencies are manageable, but fragile partner commitments still show up in harder deals.`,
        `Partner dependence is explicit and supportable enough that it does not undermine target deal quality.`,
      ],
      anti_ICP: [
        `Some opportunities should be avoided because the partner burden makes them too fragile to support credibly.`,
        `A few partner-heavy opportunities are screened out, but the boundary is not yet consistent.`,
        `${profile.company} can identify which partner-dependent opportunities belong outside the target opportunity set.`,
      ],
      misalignment: [
        `The partner story told in pursuit often differs from what partners are ready to deliver after signature.`,
        `Some partner-led pursuits stay aligned, but misalignment still weakens confidence in important deals.`,
        `Partner commitments stay aligned with the sold proposition from pursuit through delivery.`,
      ],
      win_pattern: [``, ``, ``],
      loss_pattern: [``, ``, ``],
      constraint: [``, ``, ``],
      ICP: [``, ``, ``],
    },
  };

  const selected = customScales[canonicalLens][signal];
  if (selected[0] && selected[1] && selected[2]) {
    return interpolateGtmScaleLevels(selected[0], selected[1], selected[2]);
  }

  const goldLens = getGtmGoldLens(canonicalLens);
  if (!goldLens) {
    throw new Error(`Missing GTM gold lens definition for ${canonicalLens}`);
  }

  return interpolateGtmScaleLevels(
    goldLens.scale_1_5['1'],
    goldLens.scale_1_5['3'],
    goldLens.scale_1_5['5'],
  );
}

function buildSignalFirstGtmLensPlan(lens: string): GtmLensPlan {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported GTM lens: ${lens}`);
  }

  const plans: Record<CanonicalLensName, GtmLensPlan> = {
    People: {
      tripleSignal: 'misalignment',
      tripleFocus: 'commercial story consistency in live pursuits',
      exploratory: [
        {
          signal: 'differentiation',
          tag: 'working',
          purpose: 'Identify where buyer-facing behaviour strengthens the offer in real opportunities.',
          buildQuestion: (profile) => `In recent wins, where did one person or team make ${profile.propositionFocus} feel more credible than competing offers?`,
        },
        {
          signal: 'misalignment',
          tag: 'gaps',
          purpose: 'Surface where the client hears different stories across the pursuit.',
          buildQuestion: (profile) => `Across recent losses, where did the buyer hear a different story from sales, solution, and delivery about ${profile.propositionFocus}?`,
        },
        {
          signal: 'constraint',
          tag: 'constraint',
          purpose: 'Show which opportunities stall because the right commercial capability is missing.',
          buildQuestion: (profile) => `Which live deals are hardest to progress because ${profile.company} does not yet have enough people who can sell ${profile.propositionFocus} with confidence?`,
        },
        {
          signal: 'loss_pattern',
          tag: 'pain_points',
          purpose: 'Expose the repeat loss pattern caused by weak buyer trust.',
          buildQuestion: (profile) => `In losses against ${profile.competitorFocus}, where does buyer trust in ${profile.company}'s story drop fastest during the pursuit?`,
        },
      ],
    },
    Operations: {
      tripleSignal: 'constraint',
      tripleFocus: 'delivery credibility against the offer in the market',
      exploratory: [
        {
          signal: 'anti_ICP',
          tag: 'pain_points',
          purpose: 'Identify which opportunities should be avoided because delivery cannot hold up the promise.',
          buildQuestion: (profile) => `Which opportunities in ${profile.dealScope} should now be avoided because delivery cannot support what would need to be promised to win them?`,
        },
        {
          signal: 'misalignment',
          tag: 'gaps',
          purpose: 'Reveal where sold commitments break when delivery starts.',
          buildQuestion: (profile) => `Across won deals, where did the delivery team inherit a promise about ${profile.propositionFocus} that it could not execute as sold?`,
        },
        {
          signal: 'fragility',
          tag: 'constraint',
          purpose: 'Surface the work types that repeatedly destabilise after signature.',
          buildQuestion: (profile) => `Which deal types keep becoming fragile once they move from sale into delivery in ${profile.industry}?`,
        },
        {
          signal: 'ICP',
          tag: 'working',
          purpose: 'Show where delivery capability supports commercially healthy growth.',
          buildQuestion: (profile) => `In recent wins, which client situations converted cleanly because the delivery model already matched what the buyer needed from ${profile.propositionFocus}?`,
        },
      ],
    },
    Technology: {
      tripleSignal: 'differentiation',
      tripleFocus: 'technical credibility in the sold proposition',
      exploratory: [
        {
          signal: 'win_pattern',
          tag: 'working',
          purpose: 'Identify when technology directly helps the business win.',
          buildQuestion: (profile) => `In recent wins, where did the technical story make ${profile.company} easier to choose?`,
        },
        {
          signal: 'loss_pattern',
          tag: 'gaps',
          purpose: 'Show where competitors expose technical weakness.',
          buildQuestion: (profile) => `Across recent losses, where did ${profile.competitorFocus} expose a technical weakness that made ${profile.propositionFocus} harder to trust?`,
        },
        {
          signal: 'fragility',
          tag: 'constraint',
          purpose: 'Reveal where buyers are being asked to trust claims that are not stable enough yet.',
          buildQuestion: (profile) => `Which live deals are carrying the most risk because buyers are being asked to believe a technical capability ${profile.company} cannot yet prove consistently?`,
        },
        {
          signal: 'anti_ICP',
          tag: 'pain_points',
          purpose: 'Identify work that should be avoided because technical gaps undermine the proposition.',
          buildQuestion: (profile) => `Which opportunities should be avoided because the technical gap is too wide for ${profile.propositionFocus} to stay credible through delivery?`,
        },
      ],
    },
    Commercial: {
      tripleSignal: 'ICP',
      tripleFocus: 'clarity on who to pursue and who to avoid',
      exploratory: [
        {
          signal: 'ICP',
          tag: 'working',
          purpose: 'Identify the strongest target-fit pattern in current wins.',
          buildQuestion: (profile) => `Across recent wins, which buyer and deal patterns most clearly show who ${profile.company} should target more aggressively for ${profile.outcomePrompt}?`,
        },
        {
          signal: 'anti_ICP',
          tag: 'gaps',
          purpose: 'Identify the repeat pattern of weak-fit work.',
          buildQuestion: (profile) => `Across recent losses and weak-fit pursuits, which client patterns show who ${profile.company} should stop chasing even when the revenue looks attractive?`,
        },
        {
          signal: 'win_pattern',
          tag: 'context',
          purpose: 'Show what buyers are actually choosing at the point of sale.',
          buildQuestion: (profile) => `In the deals ${profile.company} has won most cleanly, what specific commercial problem were buyers paying to solve through ${profile.propositionFocus}?`,
        },
        {
          signal: 'fragility',
          tag: 'pain_points',
          purpose: 'Surface wins that looked good at sale but damaged commercial quality later.',
          buildQuestion: (profile) => `Which won deals now look like the wrong work because they weakened delivery credibility, references, or repeatability after signature?`,
        },
      ],
    },
    Customer: {
      tripleSignal: 'misalignment',
      tripleFocus: 'how closely the lived customer experience matches what was sold',
      exploratory: [
        {
          signal: 'win_pattern',
          tag: 'working',
          purpose: 'Identify what customers value once they are living with the offer.',
          buildQuestion: (profile) => `In your strongest customer relationships, what do customers end up valuing most once they are actually living with ${profile.propositionFocus}?`,
        },
        {
          signal: 'loss_pattern',
          tag: 'pain_points',
          purpose: 'Surface what repeated churn or trust loss is revealing.',
          buildQuestion: (profile) => `When customers drift away or reduce scope, what tends to have gone wrong in the experience they actually had?`,
        },
        {
          signal: 'fragility',
          tag: 'constraint',
          purpose: 'Show where customer relationships become unstable after sale.',
          buildQuestion: (profile) => `Which customer relationships become hardest to keep healthy once the deal is live, and what makes them so fragile?`,
        },
        {
          signal: 'differentiation',
          tag: 'gaps',
          purpose: 'Reveal where the customer experience is not yet distinct enough.',
          buildQuestion: (profile) => `Where does the customer experience still feel too similar to alternatives after the contract is signed?`,
        },
      ],
    },
    'Risk/Compliance': {
      tripleSignal: 'constraint',
      tripleFocus: 'deal viability under risk, procurement, and compliance pressure',
      exploratory: [
        {
          signal: 'anti_ICP',
          tag: 'gaps',
          purpose: 'Identify which opportunities are commercially unattractive once risk reality is applied.',
          buildQuestion: (profile) => `Across recent losses, which opportunities became unattractive once ${profile.riskFocus} were applied in full?`,
        },
        {
          signal: 'fragility',
          tag: 'constraint',
          purpose: 'Show where risk is discovered too late in the pursuit.',
          buildQuestion: (profile) => `Which live deals are most exposed because ${profile.riskFocus} are surfacing too late?`,
        },
        {
          signal: 'misalignment',
          tag: 'pain_points',
          purpose: 'Reveal where approval requirements reshape the offer after it is sold.',
          buildQuestion: (profile) => `In near-won deals, where did approvals force a reshape after the client had already bought a different expectation?`,
        },
        {
          signal: 'win_pattern',
          tag: 'working',
          purpose: 'Identify when early risk clarity helps deals stay viable.',
          buildQuestion: (profile) => `In recent wins, where did early clarity on ${profile.riskFocus} help deals move faster?`,
        },
      ],
    },
    Partners: {
      tripleSignal: 'fragility',
      tripleFocus: 'partner dependence in the sold proposition',
      exploratory: [
        {
          signal: 'differentiation',
          tag: 'working',
          purpose: 'Show when partner capability genuinely strengthens the offer.',
          buildQuestion: (profile) => `In recent wins, where did partners such as ${profile.partnerFocus.replace(/^partnerships such as /i, '').replace(/^key delivery and technology partners$/i, 'key delivery and technology partners')} make ${profile.propositionFocus} easier for the buyer to believe or buy?`,
        },
        {
          signal: 'loss_pattern',
          tag: 'gaps',
          purpose: 'Reveal where partner weakness undermines confidence.',
          buildQuestion: (profile) => `Across recent losses, where did partner weakness make the client doubt whether ${profile.company} could deliver what was being sold?`,
        },
        {
          signal: 'misalignment',
          tag: 'constraint',
          purpose: 'Expose where partner commitments do not match the offer.',
          buildQuestion: (profile) => `Which live deals are most exposed because partner commitments are weaker than the story being told about ${profile.propositionFocus}?`,
        },
        {
          signal: 'anti_ICP',
          tag: 'pain_points',
          purpose: 'Identify work that should be avoided because partner dependence is too risky.',
          buildQuestion: (profile) => `Which opportunities should be avoided because winning them would depend too heavily on partners to keep the delivery promise credible?`,
        },
      ],
    },
  };

  return plans[canonicalLens];
}

function buildSignalFirstGtmTripleRatingQuestion(
  lens: string,
  plan: GtmLensPlan,
  profile: GtmContextProfile,
): DiscoveryQuestion {
  return {
    id: nanoid(8),
    text: `Across recent wins, losses, and live deals in ${profile.dealScope}, where is ${plan.tripleFocus} today, where should it be to support ${profile.outcomePrompt}, and where will it end up if nothing changes?`,
    tag: 'triple_rating',
    maturityScale: buildGtmTripleRatingScale(lens, plan.tripleSignal, profile),
    purpose: `Assess the current, target, and projected state of ${plan.tripleFocus} in commercially relevant deals.`,
    isEdited: false,
  };
}

function buildContextualGtmDiscoveryLensQuestions(
  lens: string,
  context: PrepContext,
  research: WorkshopPrepResearch | null,
): DiscoveryLensQuestions {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) {
    throw new Error(`Unsupported GTM lens: ${lens}`);
  }
  const profile = buildGtmContextProfile(context, research);
  const plan = buildSignalFirstGtmLensPlan(canonicalLens);
  const questions: DiscoveryQuestion[] = [
    buildSignalFirstGtmTripleRatingQuestion(canonicalLens, plan, profile),
    ...plan.exploratory.map((entry) => ({
      id: nanoid(8),
      text: entry.buildQuestion(profile),
      tag: entry.tag,
      purpose: entry.purpose,
      isEdited: false,
    })),
  ];

  return {
    key: canonicalLens,
    label: canonicalLens,
    questions,
  };
}

export function buildContextualGtmDiscoveryQuestionSet(
  lensNames: string[],
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  rationale: string,
  direction?: string | null,
): DiscoveryQuestionSet {
  return {
    lenses: lensNames.map((lens) => buildContextualGtmDiscoveryLensQuestions(lens, context, research)),
    generatedAtMs: Date.now(),
    agentRationale: rationale,
    facilitatorDirection: direction || null,
  };
}

function validateDiscoveryQuestionSet(
  questionSet: DiscoveryQuestionSet,
  validationContext?: DiscoveryValidationContext,
): string | null {
  if (!questionSet.lenses.length) {
    return 'Discovery question set is empty.';
  }

  for (const lens of questionSet.lenses) {
    if (!lens.questions.length) {
      return `Lens "${lens.label}" has no questions.`;
    }
    for (const question of lens.questions) {
      const issues = validateDiscoveryQuestion(lens.key, question, validationContext);
      if (issues.length > 0) {
        return `Lens "${lens.label}" question "${question.text}" failed validation: ${issues.join('; ')}`;
      }
    }
  }

  return null;
}

export function validateDiscoveryQuestion(
  lens: string,
  question: DiscoveryQuestion,
  validationContext?: DiscoveryValidationContext,
): string[] {
  const issues: string[] = [];
  const canonicalLens = canonicalizeLensName(lens) ?? 'People';
  const workshopType = validationContext?.workshopType ?? null;
  const isGtm = isGoToMarketWorkshopType(workshopType);
  const isTransformation = isTransformationWorkshopType(workshopType);
  const isOperations = isOperationsWorkshopType(workshopType);
  const isAi = isAiWorkshopType(workshopType);
  const isFinance = isFinanceWorkshopType(workshopType);
  const workshopPack = getWorkshopPack(workshopType);
  const textFields = [question.text, ...(question.maturityScale ?? [])].join(' ').trim();
  const allFields = [question.text, question.purpose, ...(question.maturityScale ?? [])].join(' ').trim();

  if (!allFields) {
    issues.push('Question is empty');
    return issues;
  }

  if (usesForbiddenFinancialLanguage(allFields, workshopType)) {
    issues.push('contains financial terminology');
  }

  if (ROLE_SPECIFIC_KNOWLEDGE_TERMS.test(allFields) || ABSTRACT_STRATEGY_TERMS.test(allFields)) {
    issues.push('requires role-specific or abstract strategic knowledge');
  }

  if (!isGtm && question.tag !== 'triple_rating' && !exploratoryStarterPattern(workshopType).test(question.text.trim())) {
    issues.push('should be phrased as observable experience, e.g. "What happens" or "Where do you see"');
  }

  if (isGtm && GENERIC_MATURITY_LANGUAGE.test(allFields)) {
    issues.push('uses generic maturity or efficiency language instead of market-facing commercial language');
  }

  if (isGtm && isExactGtmGoldQuestionForLens(question.text, canonicalLens)) {
    issues.push('copies a gold reference question verbatim instead of contextualising it to this workshop');
  }

  if (isFinance && isExactFinanceGoldQuestion(question.text)) {
    issues.push('copies a finance gold reference question verbatim instead of contextualising it to this workshop');
  }

  if (isAi && isExactAiGoldQuestion(question.text)) {
    issues.push('copies an AI gold reference question verbatim instead of contextualising it to this workshop');
  }

  if (isTransformation && isExactTransformationGoldQuestion(question.text)) {
    issues.push('copies a Transformation gold reference question verbatim instead of contextualising it to this workshop');
  }

  if (isOperations && isExactOperationsGoldQuestion(question.text)) {
    issues.push('copies an Operations gold reference question verbatim instead of contextualising it to this workshop');
  }

  if (question.tag === 'triple_rating') {
    const normalizedText = question.text.toLowerCase();
    const hasTargetPrompt = normalizedText.includes('where should it be') || normalizedText.includes('want');
    if (!normalizedText.includes('today') || !hasTargetPrompt || !normalizedText.includes('nothing changes')) {
      issues.push('triple-rating question must ask current, target, and projected state');
    }
    if (!isGtm && !/see|experience|day-to-day work|day to day work/.test(normalizedText)) {
      issues.push('triple-rating question must anchor in observable work');
    }
    if (isOperations && !/\b(day-to-day work|day to day work|work|operation|workflow|service|flow|execution)\b/i.test(normalizedText)) {
      issues.push('for Operations workshops, triple-rating must anchor in observable work, flow, or service execution');
    }
    if (isAi && !/\b(ai|automation|workflow|data|system|tool|governance|adoption|implementation)\b/i.test(normalizedText)) {
      issues.push('for AI workshops, triple-rating must connect current reality to AI readiness, feasibility, or implementation');
    }
    if (isFinance && !/\b(value|leakage|cost|cost-to-serve|effort|waste|rework|drag|economics|return)\b/i.test(normalizedText)) {
      issues.push('for Finance workshops, triple-rating must connect current reality to value leakage, cost-to-serve, wasted effort, or value conversion');
    }
    if (isTransformation && !/\b(future state|target state|change|transformation|operating model)\b/i.test(normalizedText)) {
      issues.push('for Transformation workshops, triple-rating must connect current reality to the future state or change path');
    }
    if (isGtm && !/recent|wins|losses|deals|buyers|clients|delivery|sold|promise|market|evidence|patterns/.test(normalizedText)) {
      issues.push('for GTM workshops, triple-rating must anchor in recent wins, losses, deals, buyer patterns, or delivery-against-promise evidence');
    }
    if (isGtm && !GTM_COMMERCIAL_TERMS.test(normalizedText)) {
      issues.push('for GTM workshops, triple-rating must connect this lens to winning, losing, buyers, deals, proposition, delivery against promise, or market value');
    }
    if (isGtm) {
      const goldAnchors = getGtmGoldScaleAnchors(canonicalLens);
      if (goldAnchors.length > 0) {
        const scaleText = (question.maturityScale ?? []).join(' ').toLowerCase();
        const anchorTerms = goldAnchors.join(' ').toLowerCase();
        if (!/\b(win|wins|deal|deals|delivery|deliver|value|risk|partner|partners|client|clients|buyer|buyers|proposition|differentiat|segment|segments|sell|sold|sale)\b/i.test(scaleText || anchorTerms)) {
          issues.push('for GTM workshops, maturity scale must describe commercial outcomes rather than generic maturity');
        }
      }
    }
  }

  const standardLensContracts: Record<string, { allowed: RegExp; forbidden?: RegExp; invalidMessage: string }> = {
    People: {
      allowed: /\b(work|people|person|team|teams|colleague|colleagues|workload|clarity|support|capability|capabilities|skills?|behavio[u]?r|training|confidence|coach|coaching)\b/i,
      forbidden: /\b(hr policy|org chart|talent strategy)\b/i,
      invalidMessage: 'must ask about capability, clarity, workload, support, or behaviour in day-to-day work',
    },
    Operations: {
      allowed: /\b(flow|workflow|workflows|process|processes|handoff|handoffs|handed around|stuck|delay|delays|queue|queues|bottleneck|bottlenecks|step|steps|rework|throughput|first time right|first-time-right)\b/i,
      invalidMessage: 'must ask about flow, delays, handoffs, bottlenecks, rework, throughput, or first-time-right',
    },
    Technology: {
      allowed: /\b(tool|tools|system|systems|platform|platforms|software|screen|screens|data|technology|app|apps|workaround|workarounds|manual)\b/i,
      invalidMessage: 'must ask about tools, systems, data, usability, failures, or workarounds people deal with directly',
    },
    Commercial: {
      allowed: /\b(customer|customers|client|clients|user|users|need|needs|expectation|expectations|complaint|complaints|frustration|frustrated|confused|value|differentiation|promise|delivery|market fit|positioning|growth)\b/i,
      invalidMessage: 'must ask about client need, value clarity, differentiation, promise vs delivery, or customer pain points',
    },
    'Risk/Compliance': {
      allowed: /\b(rule|rules|check|checks|approval|approvals|control|controls|policy|policies|compliance|risk|regulatory|regulation|audit|auditable|trace|traceability)\b/i,
      invalidMessage: 'must ask about checks, approvals, controls, policy ambiguity, auditability, or compliance friction',
    },
    Partners: {
      allowed: /\b(partner|partners|supplier|suppliers|vendor|vendors|third party|third-party|external|outsourc|dependency|dependencies|handoff|provider|providers|responsiveness|accountability|bpo|ecosystem)\b/i,
      invalidMessage: 'must ask about external dependencies, third-party handoffs, responsiveness, accountability, or supplier friction',
    },
  };

  const gtmLensContracts: Record<string, { allowed: RegExp; forbidden?: RegExp; invalidMessage: string }> = {
    People: {
      allowed: /\b(win|winning|loss|deal|close deals?|closing|buyer|client|customer|proposition|position|positioning|value|trust|credibility|objection|renewal|churn|sell|sold|segment|commercial|story)\b/i,
      forbidden: /\b(hr policy|org chart|talent strategy)\b/i,
      invalidMessage: 'for GTM workshops, People must ask how people strengthen or weaken winning work, proposition credibility, buyer trust, or commercial execution',
    },
    Operations: {
      allowed: /\b(deliver|delivery|sold|sale|scope|promise|promised|handoff|implementation|onboard|onboarding|renewal|churn|win|deal|commercial|buyer|client)\b/i,
      invalidMessage: 'for GTM workshops, Operations must ask how delivery capability shapes what can be sold, or where delivery breaks what was sold',
    },
    Technology: {
      allowed: /\b(proposition|differentiat|buyer|client|clients|customer|customers|promise|promised|assume|assumed|demo|product|platform|technology|technical|system|tool|tools|capabilit|weakness|weaknesses|competitor|competitors|deliver|delivery|sold|sell|sale|market)\b/i,
      invalidMessage: 'for GTM workshops, Technology must ask how technology enables, constrains, or undermines the proposition sold to the market',
    },
    Commercial: {
      allowed: /\b(win|wins|won|winning|lose|losing|loss|losses|deal|deals|buyer|buyers|customer|customers|client|clients|icp|segment|segments|pipeline|renewal|renewals|churn|positioning|proposition|pricing|price|value|market|differentiat|revenue|margin|work)\b/i,
      invalidMessage: 'for GTM workshops, Commercial must ask about win/loss patterns, ICP fit, buyer value, positioning, pricing confidence, or market reality',
    },
    'Risk/Compliance': {
      allowed: /\b(risk|compliance|approval|approvals|procurement|legal|bid|bids|tender|tenders|deal|deals|customer|client|market|viability|speed|control|policy)\b/i,
      invalidMessage: 'for GTM workshops, Risk/Compliance must ask how risk, approvals, procurement, or compliance affect deal viability, speed, or market opportunity',
    },
    Partners: {
      allowed: /\b(partner|partners|vendor|vendors|supplier|suppliers|external|ecosystem|reseller|alliances|outsourc|delivery|deal|deals|win|client|customer|dependency|dependencies)\b/i,
      invalidMessage: 'for GTM workshops, Partners must ask how partners affect the ability to win, differentiate, or deliver what was sold',
    },
  };

  const transformationLensContracts: Record<string, { allowed: RegExp; forbidden?: RegExp; invalidMessage: string }> = {
    People: {
      allowed: /\b(change|future state|target state|readiness|fatigue|credibility|trust|behavio[u]?rs?|capability|confidence|leadership)\b/i,
      invalidMessage: 'for Transformation workshops, People must ask about readiness, credibility, fatigue, behaviour, confidence, or capability for the future state',
    },
    Operations: {
      allowed: /\b(operating model|future state|target state|handoff|handoffs|decisions?|flow|workflow|service model|dependency|dependencies|execution)\b/i,
      invalidMessage: 'for Transformation workshops, Operations must ask how the current operating model, flow, or dependencies help or block the target state',
    },
    Technology: {
      allowed: /\b(technology|system|systems|platform|platforms|architecture|data|integration|integrations|tooling|tool|tools|future state|target state)\b/i,
      invalidMessage: 'for Transformation workshops, Technology must ask how current systems, data, architecture, or tooling enable or constrain the future state',
    },
    Commercial: {
      allowed: /\b(customer|customers|client|clients|market|growth|promise|promises|expectation|expectations|demand|commercial|future state|target state)\b/i,
      invalidMessage: 'for Transformation workshops, Commercial must ask how customer, market, promise, or growth pressure shapes the need for change',
    },
    'Risk/Compliance': {
      allowed: /\b(risk|compliance|approval|approvals|governance|control|controls|policy|policies|assurance|future state|change)\b/i,
      invalidMessage: 'for Transformation workshops, Risk/Compliance must ask how governance, controls, approvals, or assurance shape the transformation path',
    },
    Partners: {
      allowed: /\b(partner|partners|vendor|vendors|supplier|suppliers|third party|third-party|external|dependency|dependencies|outsourc|future state|change)\b/i,
      invalidMessage: 'for Transformation workshops, Partners must ask how external dependencies, partners, or vendors help or block the target state',
    },
  };

  const operationsLensContracts: Record<string, { allowed: RegExp; forbidden?: RegExp; invalidMessage: string }> = {
    People: {
      allowed: /\b(clarity|role|roles|workload|pressure|support|confidence|capability|skills?|handoff|behavio[u]?r|team|teams|people)\b/i,
      invalidMessage: 'for Operations workshops, People must ask about clarity, workload, support, capability, or handoff behaviour in day-to-day work',
    },
    Operations: {
      allowed: /\b(flow|workflow|service|queue|queues|delay|delays|bottleneck|bottlenecks|handoff|handoffs|rework|decision|throughput|execution)\b/i,
      invalidMessage: 'for Operations workshops, Operations must ask about flow, bottlenecks, handoffs, rework, decision delay, or execution reliability',
    },
    Technology: {
      allowed: /\b(system|systems|tool|tools|platform|platforms|data|workaround|workarounds|automation|outage|outages|technology)\b/i,
      invalidMessage: 'for Operations workshops, Technology must ask how systems, tools, data, automation, or workarounds affect execution',
    },
    Commercial: {
      allowed: /\b(customer|customers|client|clients|service|expectation|expectations|value|complaint|complaints|delay|promise|promises|confidence)\b/i,
      invalidMessage: 'for Operations workshops, Commercial must ask how operational reality affects customer expectations, service quality, value, or confidence',
    },
    'Risk/Compliance': {
      allowed: /\b(approval|approvals|control|controls|policy|policies|risk|compliance|audit|checks?|assurance)\b/i,
      invalidMessage: 'for Operations workshops, Risk/Compliance must ask how approvals, controls, policy, or compliance affect day-to-day flow',
    },
    Partners: {
      allowed: /\b(partner|partners|vendor|vendors|supplier|suppliers|third party|third-party|external|dependency|dependencies|responsiveness|accountability|handoff)\b/i,
      invalidMessage: 'for Operations workshops, Partners must ask how external dependencies, responsiveness, accountability, or handoffs affect execution',
    },
  };

  const aiLensContracts: Record<string, { allowed: RegExp; forbidden?: RegExp; invalidMessage: string }> = {
    People: {
      allowed: /\b(ai|automation|trust|confidence|readiness|capability|skills?|role|adoption|people|teams?)\b/i,
      invalidMessage: 'for AI workshops, People must ask about trust, readiness, capability, role impact, or adoption for AI in practice',
    },
    Operations: {
      allowed: /\b(ai|automation|workflow|workflows|exception|exceptions|repeat work|handoff|handoffs|decision|decisions|fit)\b/i,
      invalidMessage: 'for AI workshops, Operations must ask how workflow, repeat work, decisions, exceptions, or handoffs shape AI fit',
    },
    Technology: {
      allowed: /\b(ai|data|system|systems|tool|tools|platform|platforms|integration|integrations|technical|technology|model|tooling)\b/i,
      invalidMessage: 'for AI workshops, Technology must ask how data, systems, tooling, integrations, or technical risk affect AI feasibility',
    },
    Commercial: {
      allowed: /\b(ai|customer|customers|client|clients|service|value|trust|promise|differentiation|quality)\b/i,
      invalidMessage: 'for AI workshops, Commercial must ask how AI could improve or weaken customer value, service quality, trust, or differentiation',
    },
    'Risk/Compliance': {
      allowed: /\b(ai|approval|approvals|governance|policy|policies|risk|compliance|assurance|auditability|audit)\b/i,
      invalidMessage: 'for AI workshops, Risk/Compliance must ask how governance, approvals, policy, assurance, or risk shape AI use',
    },
    Partners: {
      allowed: /\b(ai|partner|partners|vendor|vendors|platform|platforms|external data|external|dependency|dependencies)\b/i,
      invalidMessage: 'for AI workshops, Partners must ask how vendors, platforms, external data, or partners affect AI implementation',
    },
  };

  const financeLensContracts: Record<string, { allowed: RegExp; forbidden?: RegExp; invalidMessage: string }> = {
    People: {
      allowed: /\b(value|leakage|cost|effort|waste|ownership|decision|capability|incentive|awareness|return)\b/i,
      invalidMessage: 'for Finance workshops, People must ask how decisions, ownership, capability, incentives, or behaviour protect or weaken value',
    },
    Operations: {
      allowed: /\b(rework|delay|complexity|waste|throughput|flow|cost-to-serve|effort|queue|handoff)\b/i,
      invalidMessage: 'for Finance workshops, Operations must ask how rework, delay, complexity, flow, or waste weaken value conversion',
    },
    Technology: {
      allowed: /\b(manual|automation|tool|tools|system|systems|data|duplicate|rework|effort|cost|drag)\b/i,
      invalidMessage: 'for Finance workshops, Technology must ask how tools, systems, data, manual effort, or automation gaps create avoidable cost or drag',
    },
    Commercial: {
      allowed: /\b(client|clients|customer|customers|scope|promise|pricing|value|fit|weak-fit|work|economics|commercial)\b/i,
      invalidMessage: 'for Finance workshops, Commercial must ask how client mix, scope, promises, pricing, or weak-fit work affect value and economics',
    },
    'Risk/Compliance': {
      allowed: /\b(approval|approvals|control|controls|compliance|governance|assurance|overhead|delay|cost|drag)\b/i,
      invalidMessage: 'for Finance workshops, Risk/Compliance must ask how approvals, controls, compliance, or governance add value or create avoidable drag',
    },
    Partners: {
      allowed: /\b(partner|partners|supplier|suppliers|vendor|vendors|outsourc|dependency|dependencies|rework|cost|overhead|value)\b/i,
      invalidMessage: 'for Finance workshops, Partners must ask how suppliers, partners, outsourcing, or dependency overhead strengthen or weaken value conversion',
    },
  };

  const contract = (isGtm
    ? gtmLensContracts
    : isTransformation
      ? transformationLensContracts
      : isOperations
        ? operationsLensContracts
        : isAi
          ? aiLensContracts
        : isFinance
          ? financeLensContracts
      : standardLensContracts)[canonicalLens];
  if (contract && !contract.allowed.test(textFields)) {
    issues.push(contract.invalidMessage);
  }
  if (contract?.forbidden && contract.forbidden.test(textFields)) {
    issues.push(`contains disallowed ${canonicalLens} language`);
  }

  if (!isGtm && GENERIC_MATURITY_LANGUAGE.test(allFields)) {
    issues.push(workshopPack.validationDirective);
  }

  if (isGtm && question.tag !== 'triple_rating') {
    const normalized = question.text.toLowerCase();
    if (!/recent|wins|losses|live deals|deals|buyers|clients|sold|sale|delivery|proposal|proposition|market|renewal|churn/.test(normalized)) {
      issues.push('for GTM workshops, question must force evidence from wins, losses, live deals, buyer behaviour, or delivery-against-promise reality');
    }
    if (/, and where /.test(normalized) || /, and what types? /.test(normalized) || /, and where have /.test(normalized)) {
      issues.push('for GTM workshops, exploratory questions should isolate one signal rather than combine multiple asks');
    }
  }


  if (isAi && question.tag !== 'triple_rating') {
    const normalized = question.text.toLowerCase();
    if (!/\b(ai|automation|workflow|data|system|tool|governance|adoption|implementation)\b/.test(normalized)) {
      issues.push('for AI workshops, exploratory questions must stay tied to AI readiness, workflow fit, implementation, or governance reality');
    }
  }


  return issues;
}
