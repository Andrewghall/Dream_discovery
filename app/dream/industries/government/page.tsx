import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Government & Public Sector — Decision Intelligence with DREAM',
};

export default function GovernmentPage() {
  const industry = getIndustry('government')!;
  return <IndustryPageTemplate industry={industry} />;
}
