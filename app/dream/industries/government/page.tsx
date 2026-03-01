import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Government & Public Sector  -  Decision Intelligence with DREAM',
  description:
    'Service modernisation, citizen experience, and policy alignment for government organisations. DREAM navigates political sensitivity, bureaucratic inertia, and digital ambition.',
  alternates: { canonical: '/dream/industries/government' },
  openGraph: {
    title: 'Government & Public Sector  -  Decision Intelligence with DREAM',
    description: 'Workshop intelligence for government service modernisation and policy alignment.',
    url: '/dream/industries/government',
  },
};

export default function GovernmentPage() {
  const industry = getIndustry('government')!;
  return <IndustryPageTemplate industry={industry} />;
}
