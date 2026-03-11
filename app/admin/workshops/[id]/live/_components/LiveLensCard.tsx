'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SynthesisItem = {
  themeId: string;
  label: string;
  strength: number;
  weight: number;
  examples?: string[];
};

type DependencyEdge = {
  id: string;
  fromDomain: string;
  toDomain: string;
  count: number;
  aspirationCount: number;
  constraintCount: number;
};

type LensInsights = {
  lensDomain: string;
  outcomes: SynthesisItem[];
  dependencies: DependencyEdge[];
  blockers: DependencyEdge[];
  enablers: DependencyEdge[];
  inbound: DependencyEdge[];
} | null;

type LiveLensCardProps = {
  lensNames: string[];
  lensDomain: string | null;
  onLensDomainChange: (domain: string | null) => void;
  lensInsights: LensInsights;
};

export function LiveLensCard({
  lensNames,
  lensDomain,
  onLensDomainChange,
  lensInsights,
}: LiveLensCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lens</CardTitle>
        <CardDescription>
          Pick a domain and interpret outcomes, blockers, enablers, and dependencies
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Domain</Label>
          <Select
            value={lensDomain ?? 'none'}
            onValueChange={(v) => {
              if (v === 'none') {
                onLensDomainChange(null);
                return;
              }
              onLensDomainChange(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {lensNames.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!lensInsights ? (
          <div className="text-sm text-muted-foreground">
            Select a domain to view lens-based interpretation.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Outcomes (aspirations + opportunities)
              </div>
              {lensInsights.outcomes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No outcomes yet.</div>
              ) : (
                <div className="space-y-2">
                  {lensInsights.outcomes.map((x) => (
                    <div key={x.themeId} className="rounded-md border bg-background px-2 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">{x.label}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          ×{x.strength}
                        </div>
                      </div>
                      {x.examples?.[0] ? (
                        <div className="mt-1 text-xs text-muted-foreground">{x.examples[0]}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Blockers (constraints dominating dependencies)
              </div>
              {lensInsights.blockers.length === 0 ? (
                <div className="text-sm text-muted-foreground">No blockers detected yet.</div>
              ) : (
                <div className="space-y-2">
                  {lensInsights.blockers.map((e) => (
                    <div key={e.id} className="rounded-md border px-2 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">{e.toDomain}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          mentions: {e.count}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                        constraints: {e.constraintCount} • aspirations: {e.aspirationCount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Enablers (aspirations dominating dependencies)
              </div>
              {lensInsights.enablers.length === 0 ? (
                <div className="text-sm text-muted-foreground">No enablers detected yet.</div>
              ) : (
                <div className="space-y-2">
                  {lensInsights.enablers.map((e) => (
                    <div key={e.id} className="rounded-md border px-2 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">{e.toDomain}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          mentions: {e.count}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                        aspirations: {e.aspirationCount} • constraints: {e.constraintCount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Dependencies mentioned (what this domain references)
              </div>
              {lensInsights.dependencies.length === 0 ? (
                <div className="text-sm text-muted-foreground">No dependencies detected yet.</div>
              ) : (
                <div className="space-y-2">
                  {lensInsights.dependencies.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-md border px-2 py-2"
                    >
                      <div className="text-sm font-medium">{e.toDomain}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{e.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Inbound (other domains referencing this one)
              </div>
              {lensInsights.inbound.length === 0 ? (
                <div className="text-sm text-muted-foreground">None yet.</div>
              ) : (
                <div className="space-y-2">
                  {lensInsights.inbound.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-md border px-2 py-2"
                    >
                      <div className="text-sm font-medium">{e.fromDomain}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{e.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
