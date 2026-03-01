import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Technology — Decision Intelligence with DREAM',
};

export default function TechnologySectorPage() {
  const industry = getIndustry('technology-sector')!;
  return <IndustryPageTemplate industry={industry} />;
}
