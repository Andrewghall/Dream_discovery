'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitCompareArrows, AlertTriangle, Users, Zap, Inbox } from 'lucide-react';
import { LENS_COLORS } from '@/components/cognitive-guidance/sticky-pad';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamComparisonData {
  lensComparisons: Array<{
    lens: string;
    streamACount: number;
    streamBCount: number;
    streamAAvgSeverity: number;
    streamBAvgSeverity: number;
    alignmentGapIndex: number;
    perceptionVsReality: string;
  }>;
  overallAlignmentGap: number;
  perceptionGaps: string[];
  leadershipVsFrontline: string[];
  frictionClusters: string[];
}

interface StreamComparisonProps {
  data: StreamComparisonData | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gapColor(gap: number): { bg: string; text: string; label: string } {
  if (gap > 0.5) return { bg: '#fef2f2', text: '#dc2626', label: 'High' };
  if (gap > 0.25) return { bg: '#fffbeb', text: '#d97706', label: 'Medium' };
  return { bg: '#f0fdf4', text: '#16a34a', label: 'Low' };
}

function gapBarWidth(gap: number): number {
  // Scale 0-1 to 0-100
  return Math.min(Math.max(gap * 100, 4), 100);
}

function gapBarColor(gap: number): string {
  if (gap > 0.5) return '#ef4444';
  if (gap > 0.25) return '#f59e0b';
  return '#22c55e';
}

function lensAccentDot(lens: string): string {
  return LENS_COLORS[lens]?.bg ?? '#e2e8f0';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StreamComparison({ data }: StreamComparisonProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Run synthesis to generate stream comparison
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Stream comparison analyses alignment between Stream A (remote) and Stream B (field).
          </p>
        </CardContent>
      </Card>
    );
  }

  const overallGap = gapColor(data.overallAlignmentGap);

  return (
    <div className="space-y-6">
      {/* Overall Alignment Gap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4" />
            Overall Alignment Gap
          </CardTitle>
          <CardDescription>
            How aligned are the remote and field discovery streams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center w-20 h-20 rounded-xl text-2xl font-bold"
              style={{ backgroundColor: overallGap.bg, color: overallGap.text }}
            >
              {data.overallAlignmentGap.toFixed(2)}
            </div>
            <div className="flex-1 space-y-1">
              <Badge
                variant="outline"
                style={{
                  borderColor: overallGap.text,
                  color: overallGap.text,
                  backgroundColor: overallGap.bg,
                }}
              >
                {overallGap.label} Gap
              </Badge>
              <p className="text-xs text-muted-foreground">
                Scale: 0 = fully aligned, 1 = fully divergent
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Lens Comparison Rows */}
      {data.lensComparisons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-Lens Comparison</CardTitle>
            <CardDescription>
              Finding counts and severity by lens across both streams.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Column labels */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px_1fr] gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                <span>Lens</span>
                <span className="text-center">A Count</span>
                <span className="text-center">B Count</span>
                <span className="text-center">A Severity</span>
                <span className="text-center">B Severity</span>
                <span>Alignment Gap</span>
              </div>

              {data.lensComparisons.map((row) => {
                const barColor = gapBarColor(row.alignmentGapIndex);
                return (
                  <div
                    key={row.lens}
                    className="grid grid-cols-[1fr_80px_80px_80px_80px_1fr] gap-2 items-center text-sm py-1"
                  >
                    {/* Lens with colored dot */}
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: lensAccentDot(row.lens) }}
                      />
                      <span className="font-medium">{row.lens}</span>
                    </div>

                    {/* Stream A count */}
                    <span className="text-center tabular-nums">{row.streamACount}</span>

                    {/* Stream B count */}
                    <span className="text-center tabular-nums">{row.streamBCount}</span>

                    {/* Stream A avg severity */}
                    <span className="text-center tabular-nums">
                      {row.streamAAvgSeverity.toFixed(1)}
                    </span>

                    {/* Stream B avg severity */}
                    <span className="text-center tabular-nums">
                      {row.streamBAvgSeverity.toFixed(1)}
                    </span>

                    {/* Alignment gap bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${gapBarWidth(row.alignmentGapIndex)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <span
                        className="text-xs tabular-nums font-medium shrink-0 w-8 text-right"
                        style={{ color: barColor }}
                      >
                        {row.alignmentGapIndex.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Perception vs Reality notes */}
            {data.lensComparisons.some((r) => r.perceptionVsReality) && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Perception vs Reality Notes
                </p>
                {data.lensComparisons
                  .filter((r) => r.perceptionVsReality)
                  .map((row) => (
                    <div key={row.lens} className="flex items-start gap-2 text-sm">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: lensAccentDot(row.lens) }}
                      />
                      <span>
                        <strong>{row.lens}:</strong> {row.perceptionVsReality}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Perception Gaps */}
      {data.perceptionGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Perception Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.perceptionGaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  {gap}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Leadership vs Frontline */}
      {data.leadershipVsFrontline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leadership vs Frontline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.leadershipVsFrontline.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Friction Clusters */}
      {data.frictionClusters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Friction Clusters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.frictionClusters.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
