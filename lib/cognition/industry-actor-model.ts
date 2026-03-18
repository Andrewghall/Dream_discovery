/**
 * DREAM Industry & Actor Model
 *
 * Standardised actor sets per industry, structured around 5 tiers:
 *   Customer | Experience | Execution | Field | Intelligence
 *
 * Used as the default actor list when regenerating Actor Journey maps.
 * The facilitator can edit/add/remove actors after generation.
 */

export type ActorTier = 'Customer' | 'Experience' | 'Execution' | 'Field' | 'Intelligence';

export interface IndustryActor {
  name: string;
  tier: ActorTier;
}

export interface IndustryActorSet {
  industry: string;
  aliases: string[];
  actors: IndustryActor[];
}

export const INDUSTRY_ACTOR_MODEL: IndustryActorSet[] = [
  {
    industry: 'Retail',
    aliases: ['retail', 'ecommerce', 'e-commerce', 'consumer goods', 'fmcg'],
    actors: [
      { name: 'Shopper', tier: 'Customer' },
      { name: 'Sales Associate', tier: 'Experience' },
      { name: 'Customer Support Agent', tier: 'Experience' },
      { name: 'Returns Agent', tier: 'Experience' },
      { name: 'Warehouse / Fulfilment', tier: 'Execution' },
      { name: 'Inventory Management', tier: 'Execution' },
      { name: 'Payments / Finance', tier: 'Execution' },
      { name: 'Delivery Driver', tier: 'Field' },
      { name: 'eCommerce Platform', tier: 'Intelligence' },
      { name: 'AI Recommender / Chatbot', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Financial Services',
    aliases: ['financial services', 'finance', 'banking', 'insurance', 'fintech', 'wealth management', 'investment'],
    actors: [
      { name: 'Account Holder / Policyholder', tier: 'Customer' },
      { name: 'Contact Centre Agent', tier: 'Experience' },
      { name: 'Relationship Manager / Advisor', tier: 'Experience' },
      { name: 'Payments Processing', tier: 'Execution' },
      { name: 'Underwriting / Risk', tier: 'Execution' },
      { name: 'Fraud / Compliance', tier: 'Execution' },
      { name: 'Broker', tier: 'Field' },
      { name: 'Core Banking System', tier: 'Intelligence' },
      { name: 'AI Risk / Fraud Models', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Healthcare',
    aliases: ['healthcare', 'health', 'medical', 'nhs', 'pharma', 'pharmaceutical', 'life sciences'],
    actors: [
      { name: 'Patient', tier: 'Customer' },
      { name: 'Reception / Admin', tier: 'Experience' },
      { name: 'Clinician (Doctor / Nurse)', tier: 'Experience' },
      { name: 'Medical Records', tier: 'Execution' },
      { name: 'Diagnostics / Labs', tier: 'Execution' },
      { name: 'Billing / Insurance', tier: 'Execution' },
      { name: 'Community Nurse / Home Visit', tier: 'Field' },
      { name: 'EHR System', tier: 'Intelligence' },
      { name: 'AI Triage / Decision Support', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Manufacturing',
    aliases: ['manufacturing', 'production', 'industrial', 'engineering', 'assembly'],
    actors: [
      { name: 'Buyer / Distributor', tier: 'Customer' },
      { name: 'Sales Rep', tier: 'Experience' },
      { name: 'Account Manager', tier: 'Experience' },
      { name: 'Production', tier: 'Execution' },
      { name: 'Supply Chain / Procurement', tier: 'Execution' },
      { name: 'Quality Assurance', tier: 'Execution' },
      { name: 'Field Engineer', tier: 'Field' },
      { name: 'ERP / MES', tier: 'Intelligence' },
      { name: 'Predictive Maintenance AI', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Technology',
    aliases: ['technology', 'tech', 'saas', 'software', 'platform', 'it services', 'digital', 'cloud'],
    actors: [
      { name: 'User / Client', tier: 'Customer' },
      { name: 'Sales / SDR', tier: 'Experience' },
      { name: 'Customer Success Manager', tier: 'Experience' },
      { name: 'Support Engineer', tier: 'Experience' },
      { name: 'DevOps / Engineering', tier: 'Execution' },
      { name: 'Product / Release', tier: 'Execution' },
      { name: 'Solutions Consultant', tier: 'Field' },
      { name: 'Platform / API Layer', tier: 'Intelligence' },
      { name: 'AI Assistants', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Energy & Utilities',
    aliases: ['energy', 'utilities', 'electricity', 'gas', 'water', 'renewable', 'power', 'grid'],
    actors: [
      { name: 'Household / Business Customer', tier: 'Customer' },
      { name: 'Contact Centre Agent', tier: 'Experience' },
      { name: 'Account Manager', tier: 'Experience' },
      { name: 'Billing', tier: 'Execution' },
      { name: 'Metering', tier: 'Execution' },
      { name: 'Network Operations', tier: 'Execution' },
      { name: 'Field Engineer / Technician', tier: 'Field' },
      { name: 'Grid Systems', tier: 'Intelligence' },
      { name: 'AI Demand Forecasting', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Public Sector',
    aliases: ['public sector', 'government', 'local authority', 'council', 'civil service', 'public services'],
    actors: [
      { name: 'Citizen', tier: 'Customer' },
      { name: 'Case Worker', tier: 'Experience' },
      { name: 'Contact Centre', tier: 'Experience' },
      { name: 'Case Processing', tier: 'Execution' },
      { name: 'Compliance / Regulation', tier: 'Execution' },
      { name: 'Inspector / Officer', tier: 'Field' },
      { name: 'Case Management System', tier: 'Intelligence' },
      { name: 'AI Decision Support', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Telecommunications',
    aliases: ['telecommunications', 'telecoms', 'telecom', 'mobile', 'broadband', 'isp', 'network provider'],
    actors: [
      { name: 'Subscriber', tier: 'Customer' },
      { name: 'Sales Agent', tier: 'Experience' },
      { name: 'Support Agent', tier: 'Experience' },
      { name: 'Network Operations', tier: 'Execution' },
      { name: 'Billing', tier: 'Execution' },
      { name: 'Installation Engineer', tier: 'Field' },
      { name: 'OSS/BSS Systems', tier: 'Intelligence' },
      { name: 'AI Network Optimisation', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Education',
    aliases: ['education', 'higher education', 'university', 'school', 'training', 'e-learning', 'edtech'],
    actors: [
      { name: 'Student / Parent', tier: 'Customer' },
      { name: 'Teacher / Lecturer', tier: 'Experience' },
      { name: 'Admin / Admissions', tier: 'Experience' },
      { name: 'Curriculum Delivery', tier: 'Execution' },
      { name: 'Records / Exams', tier: 'Execution' },
      { name: 'External Tutor', tier: 'Field' },
      { name: 'LMS', tier: 'Intelligence' },
      { name: 'AI Learning Assistants', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Professional Services',
    aliases: ['professional services', 'consulting', 'advisory', 'legal', 'accounting', 'audit', 'management consulting'],
    actors: [
      { name: 'Client', tier: 'Customer' },
      { name: 'Consultant / Advisor', tier: 'Experience' },
      { name: 'Account Lead', tier: 'Experience' },
      { name: 'Delivery Team', tier: 'Execution' },
      { name: 'Research / Analysis', tier: 'Execution' },
      { name: 'On-site Consultant', tier: 'Field' },
      { name: 'Knowledge Systems', tier: 'Intelligence' },
      { name: 'AI Research Tools', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Transport & Logistics',
    aliases: ['transport', 'logistics', 'freight', 'shipping', 'supply chain', 'courier', 'last mile', 'haulage'],
    actors: [
      { name: 'Shipper / Recipient', tier: 'Customer' },
      { name: 'Customer Service', tier: 'Experience' },
      { name: 'Account Manager', tier: 'Experience' },
      { name: 'Routing / Dispatch', tier: 'Execution' },
      { name: 'Warehousing', tier: 'Execution' },
      { name: 'Driver / Courier', tier: 'Field' },
      { name: 'Fleet Systems', tier: 'Intelligence' },
      { name: 'AI Route Optimisation', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Media & Entertainment',
    aliases: ['media', 'entertainment', 'broadcast', 'streaming', 'gaming', 'publishing', 'content'],
    actors: [
      { name: 'Viewer / User', tier: 'Customer' },
      { name: 'Customer Support', tier: 'Experience' },
      { name: 'Community Manager', tier: 'Experience' },
      { name: 'Content Production', tier: 'Execution' },
      { name: 'Distribution', tier: 'Execution' },
      { name: 'Event Staff', tier: 'Field' },
      { name: 'Streaming Platform', tier: 'Intelligence' },
      { name: 'AI Recommendation', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Home Services',
    aliases: ['home services', 'facilities management', 'facilities', 'maintenance', 'pest control', 'cleaning'],
    actors: [
      { name: 'Homeowner / Tenant', tier: 'Customer' },
      { name: 'Booking Agent', tier: 'Experience' },
      { name: 'Customer Support', tier: 'Experience' },
      { name: 'Scheduling / Dispatch', tier: 'Execution' },
      { name: 'Billing', tier: 'Execution' },
      { name: 'Technician', tier: 'Field' },
      { name: 'Job Management System', tier: 'Intelligence' },
      { name: 'AI Scheduling / Diagnosis', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Waste Management',
    aliases: ['waste management', 'waste', 'recycling', 'environmental services', 'refuse', 'sanitation', 'biffa', 'veolia', 'suez', 'waste disposal'],
    actors: [
      { name: 'Household / Business', tier: 'Customer' },
      { name: 'Customer Service', tier: 'Experience' },
      { name: 'Route Planning', tier: 'Execution' },
      { name: 'Compliance', tier: 'Execution' },
      { name: 'Collection Crew', tier: 'Field' },
      { name: 'Fleet / Route Systems', tier: 'Intelligence' },
      { name: 'AI Optimisation', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Real Estate & Property',
    aliases: ['real estate', 'property', 'housing', 'construction sales', 'proptech'],
    actors: [
      { name: 'Buyer / Tenant / Landlord', tier: 'Customer' },
      { name: 'Agent / Broker', tier: 'Experience' },
      { name: 'Property Management', tier: 'Execution' },
      { name: 'Contracts / Legal', tier: 'Execution' },
      { name: 'Property Manager', tier: 'Field' },
      { name: 'CRM / Listing Platforms', tier: 'Intelligence' },
      { name: 'AI Valuation', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Automotive & Mobility',
    aliases: ['automotive', 'mobility', 'car', 'vehicle', 'dealership', 'fleet management', 'electric vehicle', 'ev'],
    actors: [
      { name: 'Driver / Owner', tier: 'Customer' },
      { name: 'Sales Rep', tier: 'Experience' },
      { name: 'Service Advisor', tier: 'Experience' },
      { name: 'Workshop / Repair', tier: 'Execution' },
      { name: 'Parts Supply', tier: 'Execution' },
      { name: 'Mechanic', tier: 'Field' },
      { name: 'Vehicle Systems', tier: 'Intelligence' },
      { name: 'AI Diagnostics', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Construction & Facilities',
    aliases: ['construction', 'facilities', 'building', 'infrastructure', 'civil engineering', 'facilities management'],
    actors: [
      { name: 'Client / Owner', tier: 'Customer' },
      { name: 'Project Manager', tier: 'Experience' },
      { name: 'Build / Maintenance', tier: 'Execution' },
      { name: 'Procurement', tier: 'Execution' },
      { name: 'Site Engineer / Technician', tier: 'Field' },
      { name: 'Project Systems', tier: 'Intelligence' },
      { name: 'AI Cost / Risk Models', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Agriculture & Environmental',
    aliases: ['agriculture', 'farming', 'agritech', 'environmental', 'food production', 'horticulture'],
    actors: [
      { name: 'Farmer / Business', tier: 'Customer' },
      { name: 'Advisor', tier: 'Experience' },
      { name: 'Production', tier: 'Execution' },
      { name: 'Compliance', tier: 'Execution' },
      { name: 'Field Operator', tier: 'Field' },
      { name: 'Monitoring Systems', tier: 'Intelligence' },
      { name: 'AI Yield / Climate Models', tier: 'Intelligence' },
    ],
  },
  {
    industry: 'Airline & Aviation',
    aliases: ['airline', 'aviation', 'airport', 'flight', 'airways', 'air travel', 'jo air'],
    actors: [
      { name: 'Passenger / Traveller', tier: 'Customer' },
      { name: 'Customer Service Agent', tier: 'Experience' },
      { name: 'Contact Centre Agent', tier: 'Experience' },
      { name: 'Revenue Management', tier: 'Execution' },
      { name: 'Airport Operations', tier: 'Execution' },
      { name: 'Cabin Crew', tier: 'Field' },
      { name: 'Booking / CRM System', tier: 'Intelligence' },
      { name: 'AI Disruption & Scheduling', tier: 'Intelligence' },
    ],
  },
];

/**
 * Canonical sorted list of all industries in the model.
 * Use this as the source of truth for industry dropdowns across the app.
 */
export const INDUSTRY_OPTIONS: string[] = INDUSTRY_ACTOR_MODEL
  .map(s => s.industry)
  .sort((a, b) => a.localeCompare(b));

/**
 * Returns the actor set for the closest matching industry, or null if no match.
 *
 * Scoring (deterministic, order-independent):
 *   100 — industry name exact match (case-insensitive)
 *    80 — alias exact match
 *    60 — input contains alias (alias ≥ 4 chars, word-boundary aware)
 *    30 — alias contains input (input ≥ 4 chars, controlled partial)
 *
 * On tie: longest matching alias wins (more specific). Logs a warning if still tied.
 */
export function getIndustryActors(industry: string): IndustryActorSet | null {
  if (!industry) return null;
  const normalized = industry.toLowerCase().trim();

  let bestSet: IndustryActorSet | null = null;
  let bestScore = -1;
  let bestSpecificity = 0; // length of best matching alias (tiebreaker)

  for (const set of INDUSTRY_ACTOR_MODEL) {
    const industryLower = set.industry.toLowerCase();
    let score = 0;
    let specificity = 0;

    // Rule 1: exact industry name match
    if (industryLower === normalized) {
      score = 100;
      specificity = industryLower.length;
    } else {
      for (const alias of set.aliases) {
        const aliasLower = alias.toLowerCase();
        let aliasScore = 0;

        if (aliasLower === normalized) {
          // Rule 2: alias exact match
          aliasScore = 80;
        } else if (aliasLower.length >= 4 && normalized.includes(aliasLower)) {
          // Rule 3: input contains alias (alias long enough to be meaningful)
          aliasScore = 60;
        } else if (normalized.length >= 4 && aliasLower.includes(normalized)) {
          // Rule 4: alias contains input (controlled partial)
          aliasScore = 30;
        }

        if (aliasScore > score || (aliasScore === score && aliasLower.length > specificity)) {
          score = aliasScore;
          specificity = aliasLower.length;
        }
      }
    }

    if (score > bestScore || (score === bestScore && score > 0 && specificity > bestSpecificity)) {
      if (score === bestScore && score > 0 && bestSet !== null) {
        console.warn(
          `[getIndustryActors] Tie (score=${score}) between "${bestSet.industry}" and "${set.industry}" for input "${industry}". Picking more specific.`,
        );
      }
      bestScore = score;
      bestSpecificity = specificity;
      bestSet = set;
    }
  }

  return bestScore > 0 ? bestSet : null;
}
