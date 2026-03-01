import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Technology Sector  -  Decision Intelligence with DREAM',
  description:
    'Product strategy alignment, engineering culture, and go-to-market readiness for technology companies. DREAM surfaces the tensions between innovation speed and organisational alignment.',
  alternates: { canonical: '/dream/industries/technology-sector' },
  openGraph: {
    title: 'Technology Sector  -  Decision Intelligence with DREAM',
    description: 'Workshop intelligence for technology companies driving product and culture alignment.',
    url: '/dream/industries/technology-sector',
  },
};

export default function TechnologySectorPage() {
  const industry = getIndustry('technology-sector')!;
  return <IndustryPageTemplate industry={industry} />;
}
