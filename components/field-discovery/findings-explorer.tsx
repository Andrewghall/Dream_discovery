'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  Search,
  Inbox,
} from 'lucide-react';
import { LENS_COLORS } from '@/components/cognitive-guidance/sticky-pad';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FindingItem {
  id: string;
  sourceStream: string;
  lens: string;
  type: string;
  title: string;
  description: string;
  severityScore: number | null;
  frequencyCount: number;
  roleCoverage: string[];
  supportingQuotes: any;
  confidenceScore: number | null;
  createdAt: string;
}

interface FindingsExplorerProps {
  workshopId: string;
  findings: FindingItem[];
  onRefresh?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_LENSES = ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'] as const;
const ALL_TYPES = ['CONSTRAINT', 'OPPORTUNITY', 'RISK', 'CONTRADICTION'] as const;
const STREAM_OPTIONS = ['All', 'STREAM_A', 'STREAM_B'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lensAccentDot(lens: string): string {
  return LENS_COLORS[lens]?.bg ?? '#e2e8f0';
}

function severityBarColor(score: number): string {
  if (score >= 7) return '#ef4444';
  if (score >= 4) return '#f59e0b';
  return '#22c55e';
}

function typeBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'RISK':
    case 'CONTRADICTION':
      return 'destructive';
    case 'OPPORTUNITY':
      return 'default';
    default:
      return 'secondary';
  }
}

function streamLabel(stream: string): string {
  if (stream === 'STREAM_A') return 'Stream A';
  if (stream === 'STREAM_B') return 'Stream B';
  return stream;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FindingsExplorer({
  workshopId,
  findings,
  onRefresh,
}: FindingsExplorerProps) {
  // Filter state
  const [streamFilter, setStreamFilter] = useState<string>('All');
  const [lensFilter, setLensFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [minSeverity, setMinSeverity] = useState<number>(0);

  // Sort state
  const [sortField, setSortField] = useState<'severity' | 'frequency' | 'date'>('severity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...findings];

    // Apply filters
    if (streamFilter !== 'All') {
      result = result.filter((f) => f.sourceStream === streamFilter);
    }
    if (lensFilter !== 'All') {
      result = result.filter((f) => f.lens === lensFilter);
    }
    if (typeFilter !== 'All') {
      result = result.filter((f) => f.type === typeFilter);
    }
    if (minSeverity > 0) {
      result = result.filter(
        (f) => f.severityScore !== null && f.severityScore >= minSeverity
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'severity') {
        cmp = (a.severityScore ?? 0) - (b.severityScore ?? 0);
      } else if (sortField === 'frequency') {
        cmp = a.frequencyCount - b.frequencyCount;
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [findings, streamFilter, lensFilter, typeFilter, minSeverity, sortField, sortDir]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSort(field: 'severity' | 'frequency' | 'date') {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  // Empty state
  if (findings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No findings yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Findings will appear here after capture sessions are analysed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            {/* Stream filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Stream</label>
              <Select value={streamFilter} onValueChange={setStreamFilter}>
                <SelectTrigger className="w-[130px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STREAM_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt === 'All' ? 'All Streams' : streamLabel(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lens filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Lens</label>
              <Select value={lensFilter} onValueChange={setLensFilter}>
                <SelectTrigger className="w-[150px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Lenses</SelectItem>
                  {ALL_LENSES.map((lens) => (
                    <SelectItem key={lens} value={lens}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: lensAccentDot(lens) }}
                        />
                        {lens}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  {ALL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Min severity */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Min Severity
              </label>
              <Select
                value={String(minSeverity)}
                onValueChange={(v) => setMinSeverity(Number(v))}
              >
                <SelectTrigger className="w-[100px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 0 ? 'Any' : `>= ${n}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Spacer + refresh */}
            <div className="flex-1" />
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary line */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
        <Search className="h-3.5 w-3.5" />
        Showing {filtered.length} of {findings.length} findings
      </div>

      {/* Findings list */}
      <div className="space-y-2">
        {/* Sort header */}
        <div className="grid grid-cols-[24px_1fr_90px_100px_70px_70px_90px_32px] gap-2 items-center px-3 py-2 text-xs font-medium text-muted-foreground border-b">
          <span />
          <span>Title</span>
          <span>Lens</span>
          <span>Type</span>
          <button
            className="text-left flex items-center gap-0.5 hover:text-foreground transition-colors"
            onClick={() => toggleSort('severity')}
          >
            Severity
            {sortField === 'severity' && (
              sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
            )}
          </button>
          <button
            className="text-left flex items-center gap-0.5 hover:text-foreground transition-colors"
            onClick={() => toggleSort('frequency')}
          >
            Freq
            {sortField === 'frequency' && (
              sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
            )}
          </button>
          <span>Stream</span>
          <span />
        </div>

        {filtered.map((finding) => {
          const isExpanded = expandedIds.has(finding.id);
          const severityScore = finding.severityScore ?? 0;
          const severityWidth = Math.max((severityScore / 10) * 100, 4);

          return (
            <Card key={finding.id} className="overflow-hidden">
              {/* Main row */}
              <button
                className="w-full grid grid-cols-[24px_1fr_90px_100px_70px_70px_90px_32px] gap-2 items-center px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(finding.id)}
              >
                {/* Lens dot */}
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: lensAccentDot(finding.lens) }}
                />

                {/* Title */}
                <span className="font-medium truncate">{finding.title}</span>

                {/* Lens text */}
                <span className="text-xs text-muted-foreground">{finding.lens}</span>

                {/* Type badge */}
                <Badge variant={typeBadgeVariant(finding.type)} className="text-[10px] w-fit">
                  {finding.type}
                </Badge>

                {/* Severity bar */}
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-8 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${severityWidth}%`,
                        backgroundColor: severityBarColor(severityScore),
                      }}
                    />
                  </div>
                  <span className="text-xs tabular-nums">
                    {finding.severityScore !== null ? finding.severityScore.toFixed(1) : '-'}
                  </span>
                </div>

                {/* Frequency */}
                <span className="text-xs tabular-nums text-center">{finding.frequencyCount}</span>

                {/* Stream badge */}
                <Badge variant="outline" className="text-[10px] w-fit">
                  {streamLabel(finding.sourceStream)}
                </Badge>

                {/* Expand icon */}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <CardContent className="pt-0 pb-4 border-t bg-muted/30">
                  <div className="space-y-3 pt-3">
                    {/* Description */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Description
                      </p>
                      <p className="text-sm">{finding.description}</p>
                    </div>

                    {/* Supporting quotes */}
                    {finding.supportingQuotes &&
                      Array.isArray(finding.supportingQuotes) &&
                      finding.supportingQuotes.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Supporting Quotes
                          </p>
                          <div className="space-y-1.5">
                            {(finding.supportingQuotes as Array<{ text?: string }>).map(
                              (quote, qi) => (
                                <blockquote
                                  key={qi}
                                  className="text-sm italic border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground"
                                >
                                  {typeof quote === 'string' ? quote : quote?.text ?? JSON.stringify(quote)}
                                </blockquote>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Role coverage + confidence */}
                    <div className="flex flex-wrap items-center gap-3">
                      {finding.roleCoverage.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-muted-foreground">
                            Roles:
                          </span>
                          {finding.roleCoverage.map((role) => (
                            <Badge key={role} variant="outline" className="text-[10px]">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {finding.confidenceScore !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            Confidence:
                          </span>
                          <span className="text-xs tabular-nums">
                            {(finding.confidenceScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Created:
                        </span>
                        <span className="text-xs">{formatDate(finding.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* No results after filtering */}
      {filtered.length === 0 && findings.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No findings match the current filters.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setStreamFilter('All');
              setLensFilter('All');
              setTypeFilter('All');
              setMinSeverity(0);
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
