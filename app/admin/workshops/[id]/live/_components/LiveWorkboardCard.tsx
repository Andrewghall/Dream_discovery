'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { HemisphereNodeDatum } from '@/components/live/hemisphere-nodes';
import { bestConfidence } from './LiveSessionModals';

type WorkboardData = {
  total: number;
  unclassified: number;
  byType: Record<string, number>;
  recent: HemisphereNodeDatum[];
};

type LiveWorkboardCardProps = {
  phaseLabel: string;
  workboard: WorkboardData;
  selectedNode: HemisphereNodeDatum | null | undefined;
  onNodeClick: (id: string) => void;
};

export function LiveWorkboardCard({
  phaseLabel,
  workboard,
  selectedNode,
  onNodeClick,
}: LiveWorkboardCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workboard</CardTitle>
        <CardDescription>{phaseLabel} • What&apos;s happening in the room</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Utterances</div>
            <div className="text-2xl font-bold">{workboard.total}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Unclassified</div>
            <div className="text-2xl font-bold">{workboard.unclassified}</div>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground mb-2">Types</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.keys(workboard.byType).length === 0 ? (
              <div className="text-muted-foreground">No classifications yet.</div>
            ) : (
              Object.entries(workboard.byType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <div className="font-medium">{k}</div>
                    <div className="tabular-nums">{v}</div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground mb-2">Selected</div>
          {selectedNode ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {selectedNode.speakerId && (
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {selectedNode.speakerId.replace('speaker_', 'Speaker ')}
                  </span>
                )}
                <div className="text-sm font-medium">
                  {selectedNode.classification?.primaryType ?? 'UNCLASSIFIED'}
                  {bestConfidence(selectedNode) != null
                    ? ` • ${(bestConfidence(selectedNode)! * 100).toFixed(0)}%`
                    : ''}
                </div>
              </div>
              <div className="text-sm whitespace-pre-wrap break-words">{selectedNode.rawText}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Click a node to select it.</div>
          )}
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground mb-2">Recent</div>
          <div className="space-y-2">
            {workboard.recent.length === 0 ? (
              <div className="text-sm text-muted-foreground">No utterances yet.</div>
            ) : (
              workboard.recent.map((n) => (
                <button
                  key={n.dataPointId}
                  type="button"
                  className="w-full min-w-0 text-left rounded-md border bg-background px-2 py-2 hover:bg-muted/40"
                  onClick={() => onNodeClick(n.dataPointId)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {n.speakerId && (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        {n.speakerId.replace('speaker_', 'S')}
                      </span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {n.classification?.primaryType ?? 'UNCLASSIFIED'}
                    </div>
                  </div>
                  <div className="min-w-0 text-sm font-medium whitespace-normal break-words">
                    {n.rawText}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
