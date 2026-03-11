'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SynthesisItem = {
  themeId: string;
  label: string;
  strength: number;
  examples?: string[];
};

type DomainSynthesis = {
  aspirations: SynthesisItem[];
  constraints: SynthesisItem[];
  enablers: SynthesisItem[];
  opportunities: SynthesisItem[];
};

type LiveSynthesisCardProps = {
  lensNames: string[];
  synthesisByDomain: Record<string, DomainSynthesis | undefined>;
};

function SynthesisItemList({ items }: { items: SynthesisItem[] }) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">—</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((x) => (
        <div key={x.themeId} className="rounded-md border bg-background px-2 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{x.label}</div>
            <div className="text-xs text-muted-foreground tabular-nums">×{x.strength}</div>
          </div>
          {x.examples?.[0] ? (
            <div className="mt-1 text-xs text-muted-foreground">{x.examples[0]}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function LiveSynthesisCard({ lensNames, synthesisByDomain }: LiveSynthesisCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Synthesis</CardTitle>
        <CardDescription>
          Dominant themes by domain (weighted by repetition and recency)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lensNames.map((d) => {
          const s = synthesisByDomain[d];
          const hasAny =
            (s?.aspirations?.length || 0) +
              (s?.constraints?.length || 0) +
              (s?.enablers?.length || 0) +
              (s?.opportunities?.length || 0) >
            0;

          return (
            <div key={d} className="rounded-md border p-3">
              <div className="text-sm font-medium mb-2">{d}</div>
              {!hasAny ? (
                <div className="text-sm text-muted-foreground">No synthesis yet.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Aspirations</div>
                    <SynthesisItemList items={s?.aspirations || []} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Constraints</div>
                    <SynthesisItemList items={s?.constraints || []} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Enablers</div>
                    <SynthesisItemList items={s?.enablers || []} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Opportunities</div>
                    <SynthesisItemList items={s?.opportunities || []} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
