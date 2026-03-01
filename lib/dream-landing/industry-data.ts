export interface IndustryData {
  slug: string;
  name: string;
  tagline: string;
  headline: string;
  subheadline: string;
  challenges: { title: string; description: string }[];
  dreamHelps: { phase: string; description: string }[];
  exampleInsights: string[];
  relatedUseCases: { href: string; title: string }[];
}

export const INDUSTRIES: Record<string, IndustryData> = {
  'financial-services': {
    slug: 'financial-services',
    name: 'Financial Services',
    tagline: 'Digital transformation, regulatory compliance, customer experience redesign',
    headline: 'Decision Intelligence for Financial Services',
    subheadline:
      'Navigate regulatory complexity, digital transformation, and customer expectations with clarity. DREAM surfaces the real tensions between innovation appetite and compliance culture.',
    challenges: [
      {
        title: 'Regulatory Burden vs Innovation',
        description:
          'Compliance teams resist speed. Innovation teams resist controls. The result is paralysis — or worse, uncontrolled experimentation that creates regulatory exposure.',
      },
      {
        title: 'Customer Experience Expectations',
        description:
          'Customers expect digital-first, frictionless experiences. Legacy systems and risk culture create friction at every touchpoint. The gap between expectation and delivery grows wider.',
      },
      {
        title: 'Digital Transformation Fatigue',
        description:
          'Multiple transformation programmes running simultaneously. Teams are stretched. Initiative fatigue sets in. Each programme competes for the same resources and attention.',
      },
      {
        title: 'Risk Culture vs Growth Culture',
        description:
          'Financial services organisations are built on risk management. But growth requires risk-taking. DREAM reveals where these cultures collide — and where they can coexist.',
      },
    ],
    dreamHelps: [
      {
        phase: 'Discover',
        description:
          'Surfaces the real maturity gap between compliance readiness and innovation capability. Captures what frontline advisors, risk officers, and transformation leads actually think — not what they present in steering committees.',
      },
      {
        phase: 'Reimagine',
        description:
          'Envisions the future without regulatory fear blocking creativity. What would the ideal customer experience look like if compliance was already solved?',
      },
      {
        phase: 'Apply',
        description:
          'Builds constraint-aware transformation plans that satisfy regulators AND customers. Maps every regulatory barrier to the innovation it blocks, then designs paths that respect both.',
      },
    ],
    exampleInsights: [
      '82% of advisors rated digital capability at 2/10 while the CTO\'s roadmap assumed 6/10',
      'The word "compliance" appeared 47 times in constraint responses but zero times in vision responses',
      'Customer domain received the highest creative density but the lowest constraint attention — a blind spot',
    ],
    relatedUseCases: [
      { href: '/dream/use-cases/enterprise-ai-adoption', title: 'Enterprise AI Adoption' },
    ],
  },

  healthcare: {
    slug: 'healthcare',
    name: 'Healthcare',
    tagline: 'Service redesign, workforce transformation, patient journey optimisation',
    headline: 'Decision Intelligence for Healthcare',
    subheadline:
      'Healthcare transformation is uniquely complex — clinical priorities, workforce pressures, patient safety, and digital ambition must all be balanced. DREAM reveals where these forces align and where they collide.',
    challenges: [
      {
        title: 'Clinical vs Administrative Priorities',
        description:
          'Clinicians focus on patient outcomes. Administrators focus on efficiency and cost. These aren\'t opposing goals — but without structured dialogue, they become opposing camps.',
      },
      {
        title: 'Workforce Under Pressure',
        description:
          'Staff burnout, recruitment challenges, and skills gaps create a workforce that is resistant to change — not because they don\'t want improvement, but because they have no capacity for it.',
      },
      {
        title: 'Patient Journey Complexity',
        description:
          'Patients don\'t experience departments — they experience journeys. But most healthcare organisations are structured around departments, creating handoff gaps that patients feel but nobody owns.',
      },
      {
        title: 'Digital Transformation in Clinical Settings',
        description:
          'Technology must serve clinical workflow, not disrupt it. The gap between what technology teams build and what clinicians need is often invisible until deployment fails.',
      },
    ],
    dreamHelps: [
      {
        phase: 'Discover',
        description:
          'Captures perspectives from clinicians, administrators, patients (via proxies), technology teams, and compliance officers. All five organisational domains explored across every layer.',
      },
      {
        phase: 'Reimagine',
        description:
          'Envisions patient-centred service delivery unconstrained by current departmental structures. What would healthcare look like if it were designed around the patient journey?',
      },
      {
        phase: 'Apply',
        description:
          'Builds transformation plans that respect clinical workflow, workforce capacity, patient safety requirements, and regulatory obligations simultaneously.',
      },
    ],
    exampleInsights: [
      'Clinicians and administrators agreed on the future vision — but had completely different views on the starting point',
      'Patient experience was the highest-priority domain in Reimagine but received zero attention in current governance structures',
      'Workforce capacity was rated as the #1 constraint by 90% of participants — but didn\'t appear in the board\'s transformation priorities',
    ],
    relatedUseCases: [
      { href: '/dream/use-cases/enterprise-ai-adoption', title: 'Enterprise AI Adoption' },
    ],
  },

  government: {
    slug: 'government',
    name: 'Government & Public Sector',
    tagline: 'Service modernisation, citizen experience, policy alignment',
    headline: 'Decision Intelligence for Government',
    subheadline:
      'Public sector transformation operates under unique constraints — political cycles, public accountability, cross-departmental complexity, and citizen expectations. DREAM maps all of them.',
    challenges: [
      {
        title: 'Cross-Departmental Alignment',
        description:
          'Government services span multiple departments, each with its own priorities, budgets, and timelines. Citizen-centred transformation requires alignment that organisational structures resist.',
      },
      {
        title: 'Political Cycles and Continuity',
        description:
          'Transformation programmes must survive political transitions. Strategies that depend on a single administration\'s priorities are fragile. DREAM builds consensus that transcends cycles.',
      },
      {
        title: 'Citizen Expectations',
        description:
          'Citizens compare government services to private sector experiences. The gap between expectation and delivery erodes public trust — but the constraints on innovation are fundamentally different.',
      },
      {
        title: 'Legacy Systems and Procurement',
        description:
          'Technology transformation in government is constrained by procurement rules, legacy integration requirements, and security standards that the private sector doesn\'t face.',
      },
    ],
    dreamHelps: [
      {
        phase: 'Discover',
        description:
          'Captures perspectives from policy makers, service delivery teams, technology units, and citizen-facing staff. Surfaces the gap between policy intent and operational reality.',
      },
      {
        phase: 'Reimagine',
        description:
          'Envisions citizen-centred service delivery that works across departmental boundaries. What would public services look like if they were designed around citizen journeys?',
      },
      {
        phase: 'Apply',
        description:
          'Builds transformation plans that respect procurement constraints, security requirements, cross-departmental governance, and political accountability.',
      },
    ],
    exampleInsights: [
      'Policy teams and service delivery teams used completely different language to describe the same citizen outcome',
      'Technology readiness varied by a factor of 5 across departments — making enterprise-wide digital strategy impossible without addressing this gap first',
      'The word "accountability" appeared 32 times in constraints but was absent from vision — suggesting governance is seen as a barrier, not an enabler',
    ],
    relatedUseCases: [
      { href: '/dream/use-cases/enterprise-ai-adoption', title: 'Enterprise AI Adoption' },
    ],
  },

  retail: {
    slug: 'retail',
    name: 'Retail & Consumer',
    tagline: 'Customer experience transformation, omnichannel strategy, workforce capability',
    headline: 'Decision Intelligence for Retail',
    subheadline:
      'Retail moves fast. Customer expectations shift constantly. DREAM gives you the organisational truth behind your omnichannel strategy — not the PowerPoint version.',
    challenges: [
      {
        title: 'Omnichannel Complexity',
        description:
          'Every channel — store, online, mobile, social — has its own team, its own metrics, and its own view of the customer. Unified experiences require unified thinking. Most organisations don\'t have it.',
      },
      {
        title: 'Customer Experience vs Operational Efficiency',
        description:
          'The best customer experience often costs the most. Operations teams optimise for efficiency. Experience teams optimise for delight. Without structured dialogue, one always wins at the other\'s expense.',
      },
      {
        title: 'Workforce Transformation',
        description:
          'Store colleagues face changing roles as digital grows. New skills, new tools, new expectations — but rarely new support. The gap between head office ambition and store-floor reality is often invisible.',
      },
      {
        title: 'Data-Driven Decision Making',
        description:
          'Retailers have more data than ever but less clarity. Every team has its own analytics stack, its own KPIs, and its own version of the truth. DREAM cuts through the data noise.',
      },
    ],
    dreamHelps: [
      {
        phase: 'Discover',
        description:
          'Captures perspectives from store teams, digital teams, supply chain, marketing, and customer insight. Surfaces where channel strategies conflict and where they can reinforce each other.',
      },
      {
        phase: 'Reimagine',
        description:
          'Envisions the customer experience unconstrained by current channel structures. What would shopping look like if there were no organisational boundaries between channels?',
      },
      {
        phase: 'Apply',
        description:
          'Builds transformation plans that balance customer experience investment with operational efficiency, scored across cost, risk, and workforce readiness dimensions.',
      },
    ],
    exampleInsights: [
      'Store teams and digital teams had zero overlap in their top-5 customer priorities',
      'Customer experience was the #1 vision theme but the #5 investment priority — a clear strategy-execution gap',
      'Supply chain constraints were identified by 16 of 20 participants but owned by nobody in the governance structure',
    ],
    relatedUseCases: [
      { href: '/dream/use-cases/enterprise-ai-adoption', title: 'Enterprise AI Adoption' },
    ],
  },

  'technology-sector': {
    slug: 'technology-sector',
    name: 'Technology',
    tagline: 'Product strategy alignment, engineering culture, go-to-market readiness',
    headline: 'Decision Intelligence for Technology Companies',
    subheadline:
      'Technology companies move fast — but not always in the same direction. DREAM aligns product, engineering, and go-to-market teams around shared strategic clarity.',
    challenges: [
      {
        title: 'Product Strategy Alignment',
        description:
          'Product teams, engineering, sales, and customers often have different views of what the product should become. DREAM surfaces these divergences before they become expensive pivots.',
      },
      {
        title: 'Engineering Culture vs Business Priorities',
        description:
          'Engineers want to build elegant solutions. Business wants to ship features. These priorities aren\'t incompatible — but without structured dialogue, they feel that way.',
      },
      {
        title: 'Go-to-Market Readiness',
        description:
          'Sales promises what engineering hasn\'t built yet. Marketing positions capabilities that don\'t exist. The gap between GTM messaging and product reality creates churn and trust erosion.',
      },
      {
        title: 'Scaling Beyond the Founder',
        description:
          'As technology companies grow, the founder\'s vision must become the organisation\'s vision. DREAM reveals where the organisation has internalised that vision — and where it hasn\'t.',
      },
    ],
    dreamHelps: [
      {
        phase: 'Discover',
        description:
          'Captures perspectives from product, engineering, sales, customer success, and leadership. Surfaces where teams agree on strategy and where they\'ve diverged without realising.',
      },
      {
        phase: 'Reimagine',
        description:
          'Envisions the product and company future unconstrained by current technical debt, team structures, or market position. What would you build if you started from scratch?',
      },
      {
        phase: 'Apply',
        description:
          'Builds roadmaps that balance technical debt reduction with feature delivery, scored across cost, risk, customer impact, and engineering complexity.',
      },
    ],
    exampleInsights: [
      'Product and engineering agreed on the vision but had a 4-point gap on timeline feasibility',
      'Sales described the product as "enterprise-ready" while engineering rated enterprise features at 3/10 maturity',
      'Customer domain contributions came entirely from sales — zero direct customer perspective in the room',
    ],
    relatedUseCases: [
      { href: '/dream/use-cases/enterprise-ai-adoption', title: 'Enterprise AI Adoption' },
    ],
  },

  'professional-services': {
    slug: 'professional-services',
    name: 'Professional Services',
    tagline: 'Client delivery methodology, knowledge management, growth strategy',
    headline: 'Decision Intelligence for Professional Services',
    subheadline:
      'Consultancies and advisory firms can use DREAM to deliver deeper client insight in less time — replacing weeks of interviews with structured AI-powered intelligence.',
    challenges: [
      {
        title: 'Client Discovery at Scale',
        description:
          'Traditional client discovery takes weeks of interviews, analysis, and report writing. DREAM compresses this into structured AI conversations and immediate analytical output.',
      },
      {
        title: 'Consultant Bias',
        description:
          'Every consultant brings their own frameworks and assumptions. DREAM removes consultant bias by capturing client perspectives directly through AI-guided conversations.',
      },
      {
        title: 'Knowledge Management',
        description:
          'Institutional knowledge lives in people\'s heads, not in systems. When senior consultants leave, their insights leave with them. DREAM captures and structures organisational knowledge permanently.',
      },
      {
        title: 'Differentiation',
        description:
          'Every consultancy claims to deliver strategic insight. DREAM gives you a proprietary methodology with AI-powered intelligence that clients have never experienced before.',
      },
    ],
    dreamHelps: [
      {
        phase: 'Discover',
        description:
          'Replace weeks of stakeholder interviews with structured 15-minute AI conversations. Capture every perspective across five organisational domains with maturity ratings and confidence scoring.',
      },
      {
        phase: 'Reimagine',
        description:
          'Facilitate client workshops with real-time AI synthesis. The 360° Hemisphere gives clients a visual they\'ve never seen before — their organisation\'s collective thinking mapped in real-time.',
      },
      {
        phase: 'Apply',
        description:
          'Deliver analytical output that no traditional consultancy can match. Seven views, deterministic scoring, and exportable reports — all available immediately after the workshop.',
      },
    ],
    exampleInsights: [
      'A consultancy used DREAM to compress a 6-week discovery phase into 5 days',
      'Client stakeholders rated the AI Discovery conversation higher than traditional face-to-face interviews for depth and honesty',
      'The Hemisphere Diagnostic revealed alignment gaps that the client\'s existing consulting partner had missed over 18 months',
    ],
    relatedUseCases: [
      { href: '/dream/use-cases/enterprise-ai-adoption', title: 'Enterprise AI Adoption' },
    ],
  },
};

export function getIndustry(slug: string): IndustryData | undefined {
  return INDUSTRIES[slug];
}

export function getAllIndustries(): IndustryData[] {
  return Object.values(INDUSTRIES);
}
