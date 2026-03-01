import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Retail & Consumer — Decision Intelligence with DREAM',
};

export default function RetailPage() {
  const industry = getIndustry('retail')!;
  return <IndustryPageTemplate industry={industry} />;
}
