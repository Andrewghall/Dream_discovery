'use client';

import { usePathname } from 'next/navigation';

const PAGE_NAMES: Record<string, string> = {
  '/dream': 'Home',
  '/dream/technology': 'Technology',
  '/dream/methodology': 'Methodology',
  '/dream/compare': 'How We Compare',
  '/dream/insights': 'Insights',
  '/dream/how-it-works': 'How It Works',
  '/dream/industries': 'Industries',
  '/dream/industries/financial-services': 'Financial Services',
  '/dream/industries/healthcare': 'Healthcare',
  '/dream/industries/government': 'Government & Public Sector',
  '/dream/industries/retail': 'Retail & Consumer',
  '/dream/industries/technology-sector': 'Technology Sector',
  '/dream/industries/professional-services': 'Professional Services',
  '/dream/use-cases': 'Use Cases',
  '/dream/use-cases/enterprise-ai-adoption': 'Enterprise AI Adoption',
};

export function FooterPageName() {
  const pathname = usePathname();
  const name = PAGE_NAMES[pathname] ?? 'DREAM';
  return (
    <span className="text-slate-500 text-sm">
      {name}
    </span>
  );
}
