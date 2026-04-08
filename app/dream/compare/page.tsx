import type { Metadata } from 'next';
import { ComparisonTable } from '@/components/dream-landing/comparison-table';
import { CTASection } from '@/components/dream-landing/cta-section';

export const metadata: Metadata = {
  title: 'DREAM vs Qualtrics, Medallia & InMoment — How We Compare',
  description:
    'See how DREAM goes beyond enterprise feedback platforms. Everything they do — plus cross-domain synthesis, constraint mapping, actor modelling, agentic reasoning, and a prioritised transformation plan.',
  alternates: { canonical: '/dream/compare' },
};

export default function ComparePage() {
  return (
    <>
      <ComparisonTable />
      <CTASection
        headline="Beyond feedback. Into decisions."
        subheadline="DREAM turns what your organisation thinks into a structured plan you can act on — in 90 minutes."
      />
    </>
  );
}
