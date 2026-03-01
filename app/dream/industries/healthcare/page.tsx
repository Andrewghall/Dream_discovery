import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Healthcare — Decision Intelligence with DREAM',
  description:
    'Healthcare transformation balances clinical priorities, workforce pressures, patient safety, and digital ambition. DREAM reveals where these forces align and where they collide.',
  alternates: { canonical: '/dream/industries/healthcare' },
  openGraph: {
    title: 'Healthcare — Decision Intelligence with DREAM',
    description: 'Workshop intelligence for healthcare transformation and service redesign.',
    url: '/dream/industries/healthcare',
  },
};

export default function HealthcarePage() {
  const industry = getIndustry('healthcare')!;
  return <IndustryPageTemplate industry={industry} />;
}
