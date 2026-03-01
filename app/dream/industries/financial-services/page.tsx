import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Financial Services — Decision Intelligence with DREAM',
};

export default function FinancialServicesPage() {
  const industry = getIndustry('financial-services')!;
  return <IndustryPageTemplate industry={industry} />;
}
