import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Professional Services — Decision Intelligence with DREAM',
};

export default function ProfessionalServicesPage() {
  const industry = getIndustry('professional-services')!;
  return <IndustryPageTemplate industry={industry} />;
}
