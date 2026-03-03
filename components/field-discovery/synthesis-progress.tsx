'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, Tag, Inbox } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmergingTheme {
  label: string;
  findingCount: number;
  avgSeverity: number;
}

interface SynthesisProgressProps {
  sessionsProcessed: number;
  totalSessions: number;
  roleCoverage: Record<string, number>;
  emergingThemes: Array<EmergingTheme>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityColor(severity: number): string {
  if (severity >= 7) return '#ef4444'; // red-500
  if (severity >= 4) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
}

function severityBg(severity: number): string {
  if (severity >= 7) return '#fef2f2'; // red-50
  if (severity >= 4) return '#fffbeb'; // amber-50
  return '#f0fdf4'; // green-50
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SynthesisProgress({
  sessionsProcessed,
  totalSessions,
  roleCoverage,
  emergingThemes,
}: SynthesisProgressProps) {
  const progressPercent =
    totalSessions > 0
      ? Math.round((sessionsProcessed / totalSessions) * 100)
      : 0;

  const hasData =
    sessionsProcessed > 0 ||
    Object.keys(roleCoverage).length > 0 ||
    emergingThemes.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No synthesis data yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Run synthesis to generate per-lens analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort themes by avgSeverity descending, take top 8
  const topThemes = [...emergingThemes]
    .sort((a, b) => b.avgSeverity - a.avgSeverity)
    .slice(0, 8);

  // Find max role count for scaling bars
  const roleCoverageEntries = Object.entries(roleCoverage);
  const maxRoleCount = Math.max(...roleCoverageEntries.map(([, count]) => count), 1);

  return (
    <div className="space-y-6">
      {/* Sessions Processed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Sessions Processed
          </CardTitle>
          <CardDescription>
            {sessionsProcessed} of {totalSessions} sessions synthesised
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: '#22c55e',
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Coverage */}
      {roleCoverageEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Role Coverage
            </CardTitle>
            <CardDescription>
              Number of findings surfaced per actor role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roleCoverageEntries.map(([role, count]) => {
                const barWidth = Math.max((count / maxRoleCount) * 100, 4);
                return (
                  <div key={role} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate mr-2">{role}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {count}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: '#3b82f6',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Emerging Themes */}
      {topThemes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Emerging Themes
            </CardTitle>
            <CardDescription>
              Top themes sorted by average severity. Showing up to 8.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topThemes.map((theme) => (
                <Badge
                  key={theme.label}
                  variant="outline"
                  className="text-xs px-3 py-1.5 gap-1.5"
                  style={{
                    borderColor: severityColor(theme.avgSeverity),
                    backgroundColor: severityBg(theme.avgSeverity),
                    color: severityColor(theme.avgSeverity),
                  }}
                >
                  <span className="font-semibold">{theme.label}</span>
                  <span className="opacity-70">
                    ({theme.findingCount} findings, severity {theme.avgSeverity.toFixed(1)})
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
