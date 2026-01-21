'use client';

import { useMemo } from 'react';

import { RadarChart, type RadarDatum } from '@/components/report/radar-chart';

export type LiveDomain = 'People' | 'Operations' | 'Customer' | 'Technology' | 'Regulation';

export function LiveDomainRadar(props: {
  counts: Record<LiveDomain, number>;
  className?: string;
}) {
  const { counts, className } = props;

  const data = useMemo<RadarDatum[]>(() => {
    return [
      { label: 'People', value: counts.People || 0 },
      { label: 'Organisation', value: counts.Operations || 0 },
      { label: 'Customer', value: counts.Customer || 0 },
      { label: 'Technology', value: counts.Technology || 0 },
      { label: 'Regulation', value: counts.Regulation || 0 },
    ];
  }, [counts]);

  const max = useMemo(() => {
    const m = Math.max(1, ...data.map((d) => d.value));
    return Math.max(3, m);
  }, [data]);

  return <RadarChart data={data} size={320} max={max} className={className} />;
}
