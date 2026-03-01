import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Financial Services — Decision Intelligence with DREAM',
  description:
    'Navigate regulatory complexity, digital transformation, and customer expectations in financial services. DREAM surfaces tensions between innovation appetite and compliance culture.',
  alternates: { canonical: '/dream/industries/financial-services' },
  openGraph: {
    title: 'Financial Services — Decision Intelligence with DREAM',
    description: 'Structured workshop intelligence for financial services transformation.',
    url: '/dream/industries/financial-services',
  },
};

export default function FinancialServicesPage() {
  const industry = getIndustry('financial-services')!;
  return <IndustryPageTemplate industry={industry} />;
}
