'use client';

import { useMemo } from 'react';

import { RadarChart, type RadarDatum } from '@/components/report/radar-chart';

export function LiveDomainRadar(props: {
  lensNames: string[];
  counts: Record<string, number>;
  className?: string;
}) {
  const { lensNames, counts, className } = props;

  const data = useMemo<RadarDatum[]>(() => {
    return lensNames.map((label) => ({ label, value: counts[label] || 0 }));
  }, [lensNames, counts]);

  const max = useMemo(() => {
    const m = Math.max(1, ...data.map((d) => d.value));
    return Math.max(3, m);
  }, [data]);

  return <RadarChart data={data} size={320} max={max} className={className} />;
}
