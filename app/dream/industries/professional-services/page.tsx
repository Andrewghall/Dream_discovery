import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Professional Services — Decision Intelligence with DREAM',
  description:
    'Client delivery methodology, knowledge management, and growth strategy for consulting and advisory firms. DREAM delivers deeper client insight in less time.',
  alternates: { canonical: '/dream/industries/professional-services' },
  openGraph: {
    title: 'Professional Services — Decision Intelligence with DREAM',
    description: 'Deeper client insight and structured AI intelligence for consultancies.',
    url: '/dream/industries/professional-services',
  },
};

export default function ProfessionalServicesPage() {
  const industry = getIndustry('professional-services')!;
  return <IndustryPageTemplate industry={industry} />;
}
