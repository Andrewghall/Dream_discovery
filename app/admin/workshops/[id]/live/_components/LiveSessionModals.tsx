'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HemisphereNodeDatum } from '@/components/live/hemisphere-nodes';

// ── bestConfidence helper (moved here from page.tsx) ─────────────────────────

/** Prefer agentic confidence (semantic) over classification confidence (regex/GPT-classify) */
export function bestConfidence(node: HemisphereNodeDatum | null | undefined): number | null {
  if (!node) return null;
  if (node.agenticAnalysis?.overallConfidence != null) return node.agenticAnalysis.overallConfidence;
  return node.classification?.confidence ?? null;
}

// ── MicCheckDialog ────────────────────────────────────────────────────────────

type MicCheckDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: 'unknown' | 'granted' | 'denied';
  devices: Array<{ deviceId: string; label: string }>;
  selectedMicId: string;
  /** Called when the user picks a different mic (also stops any active test) */
  onMicSelect: (deviceId: string) => void;
  /** 0–1 normalised level for the level-meter bar */
  micLevel: number;
  micTesting: boolean;
  onRefreshDevices: () => void;
  onStopTest: () => void;
  onStartTest: () => void;
};

export function MicCheckDialog({
  open,
  onOpenChange,
  permission,
  devices,
  selectedMicId,
  onMicSelect,
  micLevel,
  micTesting,
  onRefreshDevices,
  onStopTest,
  onStartTest,
}: MicCheckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Microphone check</DialogTitle>
          <DialogDescription>
            Grant microphone permission and confirm audio input is working before going live.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Input device</Label>
            <Select value={selectedMicId} onValueChange={onMicSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {devices.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No devices found
                  </SelectItem>
                ) : (
                  devices.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">Permission: {permission}</div>
          </div>

          <div className="space-y-2">
            <Label>Level</Label>
            <div className="h-3 w-full rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-green-600 transition-[width]"
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">Speak and watch the bar move.</div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onRefreshDevices}>
            Refresh devices
          </Button>
          <Button type="button" variant="outline" onClick={onStopTest} disabled={!micTesting}>
            Stop
          </Button>
          <Button type="button" onClick={onStartTest}>
            {micTesting ? 'Testing…' : 'Start test'}
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={permission !== 'granted'}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── RevealDialog ──────────────────────────────────────────────────────────────

type PressurePoint = {
  id: string;
  fromDomain: string;
  toDomain: string;
  count: number;
  constraintCount: number;
  aspirationCount: number;
};

type DependencyEdge = {
  id: string;
  fromDomain: string;
  toDomain: string;
  count: number;
};

type DomainNarrative = {
  domain: string;
  narrative: string;
  hasAny: boolean;
};

type RevealDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visionNarrative: string | null;
  domainNarratives: DomainNarrative[];
  pressurePoints: PressurePoint[];
  keyDependencies: DependencyEdge[];
};

export function RevealDialog({
  open,
  onOpenChange,
  visionNarrative,
  domainNarratives,
  pressurePoints,
  keyDependencies,
}: RevealDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reveal</DialogTitle>
          <DialogDescription>
            This view unlocks once synthesis and relationships are present.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-md border p-4">
            <div className="text-sm font-medium mb-2">Future state narrative</div>
            <div className="text-sm whitespace-pre-wrap break-words">
              {visionNarrative || '—'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domainNarratives.map((d) => (
              <div key={d.domain} className="rounded-md border p-4">
                <div className="text-sm font-medium mb-2">{d.domain}</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {d.hasAny ? d.narrative : 'No synthesis yet.'}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border p-4">
              <div className="text-sm font-medium mb-2">Systemic pressure points</div>
              {pressurePoints.length === 0 ? (
                <div className="text-sm text-muted-foreground">None detected yet.</div>
              ) : (
                <div className="space-y-2">
                  {pressurePoints.map((p) => (
                    <div key={p.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">
                          {p.fromDomain} → {p.toDomain}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">{p.count}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                        constraints: {p.constraintCount} • aspirations: {p.aspirationCount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border p-4">
              <div className="text-sm font-medium mb-2">Key dependencies</div>
              {keyDependencies.length === 0 ? (
                <div className="text-sm text-muted-foreground">None detected yet.</div>
              ) : (
                <div className="space-y-2">
                  {keyDependencies.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="text-sm font-medium">
                        {e.fromDomain} → {e.toDomain}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">{e.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── NodeDetailDialog ──────────────────────────────────────────────────────────

type NodeDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  node: HemisphereNodeDatum | null | undefined;
};

export function NodeDetailDialog({ open, onClose, node }: NodeDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Datapoint</DialogTitle>
          <DialogDescription>
            {node?.classification?.primaryType ?? 'UNCLASSIFIED'}
            {bestConfidence(node) != null
              ? ` • ${(bestConfidence(node)! * 100).toFixed(0)}%`
              : ''}
            {node?.agenticAnalysis ? ' (agentic)' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm whitespace-pre-wrap break-words">
            {node?.rawText || ''}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="font-medium mb-1">Transcript</div>
              <div className="text-muted-foreground">
                Start: {node?.transcriptChunk?.startTimeMs ?? '—'}ms
              </div>
              <div className="text-muted-foreground">
                End: {node?.transcriptChunk?.endTimeMs ?? '—'}ms
              </div>
              <div className="text-muted-foreground">
                Deepgram conf:{' '}
                {node?.transcriptChunk?.confidence == null
                  ? '—'
                  : `${(node.transcriptChunk.confidence * 100).toFixed(0)}%`}
              </div>
              <div className="text-muted-foreground">
                Source: {node?.transcriptChunk?.source ?? '—'}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="font-medium mb-1">Classification</div>
              <div className="text-muted-foreground">
                Type: {node?.classification?.primaryType ?? '—'}
              </div>
              <div className="text-muted-foreground">
                Conf:{' '}
                {node?.classification?.confidence == null
                  ? '—'
                  : `${(node.classification.confidence * 100).toFixed(0)}%`}
              </div>
              <div className="text-muted-foreground">
                Suggested area: {node?.classification?.suggestedArea ?? '—'}
              </div>
              <div className="text-muted-foreground">
                Keywords:{' '}
                {node?.classification?.keywords?.length
                  ? node.classification.keywords.join(', ')
                  : '—'}
              </div>
            </div>
          </div>

          {node?.agenticAnalysis && (
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3">
              <div className="font-medium mb-1 text-blue-800">Agentic Analysis</div>
              <div className="text-muted-foreground">
                Confidence: {(node.agenticAnalysis.overallConfidence * 100).toFixed(0)}%
              </div>
              <div className="text-muted-foreground">
                Meaning: {node.agenticAnalysis.semanticMeaning}
              </div>
              <div className="text-muted-foreground">
                Tone: {node.agenticAnalysis.sentimentTone}
              </div>
              {node.agenticAnalysis.domains.length > 0 && (
                <div className="text-muted-foreground">
                  Domains:{' '}
                  {node.agenticAnalysis.domains
                    .map((d) => `${d.domain} (${(d.relevance * 100).toFixed(0)}%)`)
                    .join(', ')}
                </div>
              )}
              {node.agenticAnalysis.themes.length > 0 && (
                <div className="text-muted-foreground">
                  Themes:{' '}
                  {node.agenticAnalysis.themes
                    .map((t) => `${t.label} (${t.category})`)
                    .join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
