import type { Metadata } from 'next';
import { getIndustry } from '@/lib/dream-landing/industry-data';
import { IndustryPageTemplate } from '@/components/dream-landing/industry-page-template';

export const metadata: Metadata = {
  title: 'Retail & Consumer  -  Decision Intelligence with DREAM',
  description:
    'CX transformation, omnichannel strategy, and workforce capability for retail organisations. DREAM reveals how to bridge the gap between customer expectations and operational reality.',
  alternates: { canonical: '/dream/industries/retail' },
  openGraph: {
    title: 'Retail & Consumer  -  Decision Intelligence with DREAM',
    description: 'Workshop intelligence for retail CX transformation and omnichannel strategy.',
    url: '/dream/industries/retail',
  },
};

export default function RetailPage() {
  const industry = getIndustry('retail')!;
  return <IndustryPageTemplate industry={industry} />;
}
