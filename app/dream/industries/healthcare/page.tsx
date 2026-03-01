import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Healthcare — Decision Intelligence with DREAM',
};

export default function HealthcarePage() {
  const industry = getIndustry('healthcare')!;
  return <IndustryPageTemplate industry={industry} />;
}
