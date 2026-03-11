'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ── Types ─────────────────────────────────────────────────────────────────────

type AggActorInfo = {
  name: string;
  roles: string[];
  mentionCount: number;
  sentiments: string[];
  dominantSentiment: string;
};

type AggInteraction = {
  fromActor: string;
  toActor: string;
  action: string;
  sentiment: string;
  context: string;
  utteranceId: string;
  stage: string;
};

type JourneyStageInfo = {
  label: string;
  orderIndex: number;
  interactionCount: number;
};

type ActorJourneyData = {
  actors: AggActorInfo[];
  stages: JourneyStageInfo[];
  grid: Map<string, AggInteraction[]>;
  totalInteractions: number;
  sentimentBreakdown: {
    positive: number;
    concerned: number;
    critical: number;
    neutral: number;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sentimentColor(sentiment: string): string {
  const s = sentiment.toLowerCase();
  if (
    s.includes('frustrat') ||
    s.includes('critical') ||
    s.includes('angry') ||
    s.includes('block') ||
    s.includes('fail') ||
    s.includes('break')
  )
    return 'bg-red-900/40 border-red-500/50 text-red-200';
  if (
    s.includes('concern') ||
    s.includes('delay') ||
    s.includes('slow') ||
    s.includes('confus') ||
    s.includes('unclear') ||
    s.includes('anxious')
  )
    return 'bg-amber-900/40 border-amber-500/50 text-amber-200';
  if (
    s.includes('smooth') ||
    s.includes('positiv') ||
    s.includes('empower') ||
    s.includes('efficien') ||
    s.includes('good') ||
    s.includes('satisf') ||
    s.includes('happy')
  )
    return 'bg-emerald-900/40 border-emerald-500/50 text-emerald-200';
  return 'bg-zinc-800/60 border-zinc-600/50 text-zinc-300';
}

function sentimentCategory(
  sentiment: string,
): 'positive' | 'concerned' | 'critical' | 'neutral' {
  const s = sentiment.toLowerCase();
  if (
    s.includes('frustrat') ||
    s.includes('critical') ||
    s.includes('angry') ||
    s.includes('block') ||
    s.includes('fail') ||
    s.includes('break')
  )
    return 'critical';
  if (
    s.includes('concern') ||
    s.includes('delay') ||
    s.includes('slow') ||
    s.includes('confus') ||
    s.includes('unclear') ||
    s.includes('anxious')
  )
    return 'concerned';
  if (
    s.includes('smooth') ||
    s.includes('positiv') ||
    s.includes('empower') ||
    s.includes('efficien') ||
    s.includes('good') ||
    s.includes('satisf') ||
    s.includes('happy')
  )
    return 'positive';
  return 'neutral';
}

// ── Component ─────────────────────────────────────────────────────────────────

type LiveActorJourneyMapProps = {
  actorJourney: ActorJourneyData;
  expanded: boolean;
  onToggleExpanded: () => void;
  onInteractionClick: (utteranceId: string) => void;
};

export function LiveActorJourneyMap({
  actorJourney,
  expanded,
  onToggleExpanded,
  onInteractionClick,
}: LiveActorJourneyMapProps) {
  if (actorJourney.totalInteractions === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Actor Journey Map</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onToggleExpanded}
          >
            {expanded ? '▲ Collapse' : '▼ Expand'}
          </Button>
        </div>
        <CardDescription>
          {actorJourney.actors.length} actor{actorJourney.actors.length !== 1 ? 's' : ''} •{' '}
          {actorJourney.totalInteractions} interaction
          {actorJourney.totalInteractions !== 1 ? 's' : ''} •{' '}
          {actorJourney.stages.length} stage{actorJourney.stages.length !== 1 ? 's' : ''}
        </CardDescription>
        {/* Sentiment breakdown bar */}
        {actorJourney.totalInteractions > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            {actorJourney.sentimentBreakdown.positive > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{
                    width: `${Math.max(8, (actorJourney.sentimentBreakdown.positive / actorJourney.totalInteractions) * 60)}px`,
                  }}
                />
                <span className="text-emerald-400 tabular-nums">
                  {actorJourney.sentimentBreakdown.positive}
                </span>
              </div>
            )}
            {actorJourney.sentimentBreakdown.concerned > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{
                    width: `${Math.max(8, (actorJourney.sentimentBreakdown.concerned / actorJourney.totalInteractions) * 60)}px`,
                  }}
                />
                <span className="text-amber-400 tabular-nums">
                  {actorJourney.sentimentBreakdown.concerned}
                </span>
              </div>
            )}
            {actorJourney.sentimentBreakdown.critical > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <div
                  className="h-2 rounded-full bg-red-500"
                  style={{
                    width: `${Math.max(8, (actorJourney.sentimentBreakdown.critical / actorJourney.totalInteractions) * 60)}px`,
                  }}
                />
                <span className="text-red-400 tabular-nums">
                  {actorJourney.sentimentBreakdown.critical}
                </span>
              </div>
            )}
            {actorJourney.sentimentBreakdown.neutral > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <div
                  className="h-2 rounded-full bg-zinc-500"
                  style={{
                    width: `${Math.max(8, (actorJourney.sentimentBreakdown.neutral / actorJourney.totalInteractions) * 60)}px`,
                  }}
                />
                <span className="text-zinc-400 tabular-nums">
                  {actorJourney.sentimentBreakdown.neutral}
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="overflow-x-auto -mx-4 px-4">
            <div
              className="grid gap-px bg-border/30 min-w-fit"
              style={{
                gridTemplateColumns: `120px repeat(${actorJourney.stages.length}, minmax(140px, 1fr))`,
              }}
            >
              {/* Header row: empty corner + stage labels */}
              <div className="bg-background p-2 sticky left-0 z-10" />
              {actorJourney.stages.map((stage) => (
                <div
                  key={stage.label}
                  className="bg-background p-2 text-center border-b"
                >
                  <div className="text-xs font-semibold">{stage.label}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {stage.interactionCount}
                  </div>
                </div>
              ))}

              {/* Actor swim-lane rows */}
              {actorJourney.actors.map((actor) => {
                const actorSentiments = actor.sentiments.map(sentimentCategory);
                const pos = actorSentiments.filter((s) => s === 'positive').length;
                const con = actorSentiments.filter((s) => s === 'concerned').length;
                const cri = actorSentiments.filter((s) => s === 'critical').length;
                const total = actorSentiments.length || 1;

                return (
                  <React.Fragment key={actor.name}>
                    {/* Actor label cell (sticky left) */}
                    <div className="bg-background p-2 sticky left-0 z-10 border-b flex flex-col justify-center min-w-[120px]">
                      <div className="text-xs font-semibold truncate">{actor.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {actor.mentionCount} mention{actor.mentionCount !== 1 ? 's' : ''}
                      </div>
                      {/* Mini sentiment bar */}
                      <div className="flex h-1.5 w-full mt-1 rounded-full overflow-hidden bg-zinc-800">
                        {pos > 0 && (
                          <div
                            className="bg-emerald-500"
                            style={{ width: `${(pos / total) * 100}%` }}
                          />
                        )}
                        {con > 0 && (
                          <div
                            className="bg-amber-500"
                            style={{ width: `${(con / total) * 100}%` }}
                          />
                        )}
                        {cri > 0 && (
                          <div
                            className="bg-red-500"
                            style={{ width: `${(cri / total) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Intersection cells */}
                    {actorJourney.stages.map((stage) => {
                      const key = `${actor.name}::${stage.label}`;
                      const interactions = actorJourney.grid.get(key);

                      return (
                        <div
                          key={key}
                          className="bg-background p-1.5 border-b min-h-[56px] flex flex-col gap-1"
                        >
                          {interactions && interactions.length > 0 ? (
                            interactions.slice(0, 3).map((ix, i) => (
                              <button
                                key={`${ix.utteranceId}-${i}`}
                                type="button"
                                className={`rounded border p-1.5 text-left transition-colors hover:ring-1 hover:ring-white/20 ${sentimentColor(ix.sentiment)}`}
                                onClick={() => onInteractionClick(ix.utteranceId)}
                              >
                                <div className="text-[11px] font-medium leading-tight line-clamp-2">
                                  {ix.action}
                                </div>
                                {ix.context && (
                                  <div className="text-[10px] opacity-70 leading-tight mt-0.5 line-clamp-1">
                                    {ix.context}
                                  </div>
                                )}
                                <div className="text-[9px] opacity-50 mt-0.5">→ {ix.toActor}</div>
                              </button>
                            ))
                          ) : (
                            <div className="h-full w-full rounded border border-dashed border-zinc-700/40" />
                          )}
                          {interactions && interactions.length > 3 && (
                            <div className="text-[10px] text-muted-foreground text-center">
                              +{interactions.length - 3} more
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
