'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Inbox,
  ChevronDown,
  ChevronRight,
  Play,
  FlaskConical,
  AudioLines,
  FileText,
  Pencil,
  Check,
  X,
  Loader2,
  RotateCcw,
  CheckSquare,
  Trash2,
  Square,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaptureSessionSegment = {
  id: string;
  segmentIndex: number;
  status: string;
  transcript?: string | null;
};

export type CaptureSessionItem = {
  id: string;
  captureType: string;
  actorRole: string | null;
  area: string | null;
  department: string | null;
  participantName: string | null;
  status: string;
  createdAt: string;
  segments: CaptureSessionSegment[] | unknown[];
  _count?: { findings: number };
};

type CaptureInboxProps = {
  workshopId: string;
  sessions: CaptureSessionItem[];
  onAnalyse?: (sessionId: string) => void;
  onResume?: (sessionId: string) => void;
  onDeleteSessions?: (sessionIds: string[]) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-700 border-gray-300',
  RECORDING: 'bg-red-100 text-red-700 border-red-300',
  PAUSED: 'bg-amber-100 text-amber-700 border-amber-300',
  UPLOADED: 'bg-blue-100 text-blue-700 border-blue-300',
  TRANSCRIBED: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  ANALYSED: 'bg-green-100 text-green-700 border-green-300',
};

const CAPTURE_TYPE_LABELS: Record<string, string> = {
  WALKAROUND: 'Walkaround',
  EXECUTIVE_INTERVIEW: 'Executive',
  MANAGER_INTERVIEW: 'Manager',
  OPERATIONAL_INTERVIEW: 'Operational',
};

const ALL_FILTER = '__ALL__';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadgeClass(status: string): string {
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-300';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Session Row
// ---------------------------------------------------------------------------

function SessionRow({
  session,
  workshopId,
  onAnalyse,
  onResume,
}: {
  session: CaptureSessionItem;
  workshopId: string;
  onAnalyse?: (id: string) => void;
  onResume?: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  // Detailed segments fetched on expand (includes transcript text)
  const [detailedSegments, setDetailedSegments] = React.useState<
    CaptureSessionSegment[] | null
  >(null);
  const [loadingSegments, setLoadingSegments] = React.useState(false);

  // Transcript editing state
  const [editingTranscript, setEditingTranscript] = React.useState<{
    sessionId: string;
    segmentId: string;
  } | null>(null);
  const [editingTranscriptText, setEditingTranscriptText] =
    React.useState('');
  const [savingTranscript, setSavingTranscript] = React.useState(false);

  // Track which sessions have had transcripts edited (for re-analyse button)
  const [transcriptEdited, setTranscriptEdited] = React.useState(false);

  // Re-analyse loading state
  const [reanalysing, setReanalysing] = React.useState(false);

  const captureLabel =
    CAPTURE_TYPE_LABELS[session.captureType] || session.captureType;
  const canAnalyse = session.status === 'TRANSCRIBED';
  const canResume =
    session.status === 'OPEN' || session.status === 'PAUSED';

  // Fetch detailed session (with transcripts) when first expanded
  const fetchDetailedSegments = React.useCallback(async () => {
    if (detailedSegments !== null) return; // already loaded
    setLoadingSegments(true);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/capture-sessions/${session.id}`
      );
      if (res.ok) {
        const data = await res.json();
        const segs: CaptureSessionSegment[] = (
          data.session?.segments ?? []
        ).map(
          (s: Record<string, unknown>) =>
            ({
              id: s.id as string,
              segmentIndex: s.segmentIndex as number,
              status: s.status as string,
              transcript: (s.transcript as string | null) ?? null,
            }) satisfies CaptureSessionSegment
        );
        setDetailedSegments(segs);
      }
    } catch (err) {
      console.error('Failed to fetch session details:', err);
    } finally {
      setLoadingSegments(false);
    }
  }, [workshopId, session.id, detailedSegments]);

  const handleToggleExpand = React.useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      if (next) {
        // Fetch on first expand
        fetchDetailedSegments();
      }
      return next;
    });
  }, [fetchDetailedSegments]);

  // Start editing a transcript
  const handleStartEdit = (segmentId: string, currentText: string) => {
    setEditingTranscript({ sessionId: session.id, segmentId });
    setEditingTranscriptText(currentText);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingTranscript(null);
    setEditingTranscriptText('');
  };

  // Save edited transcript
  const handleSaveTranscript = async () => {
    if (!editingTranscript) return;
    setSavingTranscript(true);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/capture-sessions/${session.id}/segments`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segmentId: editingTranscript.segmentId,
            transcript: editingTranscriptText,
          }),
        }
      );
      if (res.ok) {
        // Update local segments state
        setDetailedSegments((prev) =>
          prev
            ? prev.map((seg) =>
                seg.id === editingTranscript.segmentId
                  ? { ...seg, transcript: editingTranscriptText }
                  : seg
              )
            : prev
        );
        setTranscriptEdited(true);
        setEditingTranscript(null);
        setEditingTranscriptText('');
      } else {
        console.error('Failed to save transcript:', await res.text());
      }
    } catch (err) {
      console.error('Failed to save transcript:', err);
    } finally {
      setSavingTranscript(false);
    }
  };

  // Re-analyse session after transcript edits
  const handleReanalyse = async () => {
    setReanalysing(true);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/capture-sessions/${session.id}/analyse`,
        { method: 'POST' }
      );
      if (res.ok) {
        setTranscriptEdited(false);
        // Refresh session details
        setDetailedSegments(null);
        fetchDetailedSegments();
        // Also call the parent onAnalyse if available (to refresh outer list)
        onAnalyse?.(session.id);
      } else {
        console.error('Failed to re-analyse:', await res.text());
      }
    } catch (err) {
      console.error('Failed to re-analyse:', err);
    } finally {
      setReanalysing(false);
    }
  };

  // Which segments to render: prefer detailed (with transcripts), fall back to props
  const displaySegments: CaptureSessionSegment[] = detailedSegments
    ? detailedSegments
    : (session.segments as CaptureSessionSegment[]);

  return (
    <div className="rounded-lg border">
      {/* Main row */}
      <button
        type="button"
        onClick={handleToggleExpand}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        )}

        {/* Capture type badge */}
        <Badge variant="outline" className="shrink-0">
          {captureLabel}
        </Badge>

        {/* Actor role and area */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {session.actorRole || 'No role specified'}
          </span>
          {(session.area || session.department) && (
            <span className="text-muted-foreground truncate text-xs">
              {[session.area, session.department].filter(Boolean).join(' / ')}
            </span>
          )}
        </div>

        {/* Segment count */}
        <div className="flex items-center gap-1 shrink-0">
          <AudioLines className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground text-xs">
            {session.segments.length}
          </span>
        </div>

        {/* Findings count */}
        <div className="flex items-center gap-1 shrink-0">
          <FileText className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground text-xs">
            {session._count?.findings ?? 0}
          </span>
        </div>

        {/* Status badge */}
        <Badge
          variant="outline"
          className={`shrink-0 ${getStatusBadgeClass(session.status)}`}
        >
          {session.status}
        </Badge>

        {/* Date */}
        <span className="text-muted-foreground shrink-0 text-xs">
          {formatDate(session.createdAt)}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-4 py-3">
          {/* Participant name */}
          {session.participantName && (
            <p className="text-muted-foreground mb-2 text-xs">
              Participant: {session.participantName}
            </p>
          )}

          {/* Segment list with transcripts */}
          {loadingSegments ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-xs">
                Loading segments...
              </span>
            </div>
          ) : displaySegments.length > 0 ? (
            <div className="mb-3 flex flex-col gap-2">
              <span className="text-xs font-medium">Segments</span>
              {displaySegments.map((seg) => {
                const isEditing =
                  editingTranscript?.sessionId === session.id &&
                  editingTranscript?.segmentId === seg.id;

                return (
                  <div
                    key={seg.id}
                    className="rounded bg-gray-50 px-3 py-2 text-xs"
                  >
                    {/* Segment header row */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">
                        Segment {seg.segmentIndex + 1}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getStatusBadgeClass(seg.status)}`}
                      >
                        {seg.status}
                      </Badge>
                    </div>

                    {/* Transcript display or edit */}
                    {isEditing ? (
                      <div className="mt-1 flex flex-col gap-2">
                        <Textarea
                          value={editingTranscriptText}
                          onChange={(e) =>
                            setEditingTranscriptText(e.target.value)
                          }
                          rows={5}
                          className="text-xs"
                          placeholder="Enter transcript text..."
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveTranscript}
                            disabled={savingTranscript}
                            className="gap-1 h-7 text-xs"
                          >
                            {savingTranscript ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={savingTranscript}
                            className="gap-1 h-7 text-xs"
                          >
                            <X className="size-3" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {seg.transcript ? (
                            <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                              {seg.transcript}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No transcript
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleStartEdit(seg.id, seg.transcript ?? '')
                          }
                          className="shrink-0 p-1 rounded hover:bg-gray-200 transition-colors text-muted-foreground hover:text-gray-700"
                          title="Edit transcript"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground mb-3 text-xs">
              No segments recorded yet
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {transcriptEdited && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReanalyse}
                disabled={reanalysing}
                className="gap-1.5"
              >
                {reanalysing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Re-analyse
              </Button>
            )}
            {canAnalyse && onAnalyse && (
              <Button
                size="sm"
                onClick={() => onAnalyse(session.id)}
                className="gap-1.5"
              >
                <FlaskConical className="size-3.5" />
                Analyse
              </Button>
            )}
            {canResume && onResume && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResume(session.id)}
                className="gap-1.5"
              >
                <Play className="size-3.5" />
                Resume
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CaptureInbox({
  workshopId,
  sessions,
  onAnalyse,
  onResume,
  onDeleteSessions,
}: CaptureInboxProps) {
  const [filterType, setFilterType] = React.useState(ALL_FILTER);
  const [filterStatus, setFilterStatus] = React.useState(ALL_FILTER);
  const [filterRole, setFilterRole] = React.useState('');

  // Multi-select state
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const toggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = React.useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  }, []);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!onDeleteSessions || selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await onDeleteSessions(Array.from(selectedIds));
      exitSelectionMode();
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [onDeleteSessions, selectedIds, exitSelectionMode]);

  // Derive unique values for filter dropdowns
  const uniqueTypes = React.useMemo(
    () => Array.from(new Set(sessions.map((s) => s.captureType))),
    [sessions]
  );

  const uniqueStatuses = React.useMemo(
    () => Array.from(new Set(sessions.map((s) => s.status))),
    [sessions]
  );

  const uniqueRoles = React.useMemo(
    () =>
      Array.from(
        new Set(sessions.map((s) => s.actorRole).filter(Boolean) as string[])
      ),
    [sessions]
  );

  // Apply filters
  const filtered = React.useMemo(() => {
    return sessions.filter((s) => {
      if (filterType !== ALL_FILTER && s.captureType !== filterType) {
        return false;
      }
      if (filterStatus !== ALL_FILTER && s.status !== filterStatus) {
        return false;
      }
      if (
        filterRole &&
        (!s.actorRole ||
          !s.actorRole.toLowerCase().includes(filterRole.toLowerCase()))
      ) {
        return false;
      }
      return true;
    });
  }, [sessions, filterType, filterStatus, filterRole]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox className="size-5" />
            Capture Sessions
            <Badge variant="secondary" className="ml-1">
              {sessions.length}
            </Badge>
          </CardTitle>
          {onDeleteSessions && sessions.length > 0 && (
            <div className="flex items-center gap-2">
              {selectionMode && selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete ({selectedIds.size})
                </Button>
              )}
              <Button
                variant={selectionMode ? 'outline' : 'ghost'}
                size="sm"
                onClick={selectionMode ? exitSelectionMode : () => setSelectionMode(true)}
              >
                {selectionMode ? (
                  <><X className="h-4 w-4 mr-1.5" />Cancel</>
                ) : (
                  <><CheckSquare className="h-4 w-4 mr-1.5" />Select</>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="mx-6 mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Trash2 className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Delete {selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''}?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This will permanently remove the recording{selectedIds.size !== 1 ? 's' : ''},
                transcripts, and all findings extracted from {selectedIds.size !== 1 ? 'them' : 'it'}.
                This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Deleting…</> : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      <CardContent className="flex flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]" size="sm">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All types</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CAPTURE_TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]" size="sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                {uniqueStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {uniqueRoles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Actor Role</Label>
              <Input
                placeholder="Filter by role..."
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="h-8 w-[180px] text-sm"
              />
            </div>
          )}

          {(filterType !== ALL_FILTER ||
            filterStatus !== ALL_FILTER ||
            filterRole) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterType(ALL_FILTER);
                setFilterStatus(ALL_FILTER);
                setFilterRole('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Session list */}
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filtered.map((session) => (
              <div
                key={session.id}
                className={`flex items-start gap-2 ${selectionMode ? 'cursor-pointer' : ''} ${selectionMode && selectedIds.has(session.id) ? 'rounded-xl ring-2 ring-destructive/40 bg-destructive/5' : ''}`}
                onClick={selectionMode ? () => toggleSelect(session.id) : undefined}
              >
                {selectionMode && (
                  <button
                    className="mt-3 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(session.id); }}
                    aria-label={selectedIds.has(session.id) ? 'Deselect' : 'Select'}
                  >
                    {selectedIds.has(session.id)
                      ? <CheckSquare className="h-5 w-5 text-destructive" />
                      : <Square className="h-5 w-5" />
                    }
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <SessionRow
                    session={session}
                    workshopId={workshopId}
                    onAnalyse={selectionMode ? undefined : onAnalyse}
                    onResume={selectionMode ? undefined : onResume}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="text-muted-foreground mb-3 size-10 opacity-40" />
            <p className="text-muted-foreground text-sm">
              {sessions.length === 0
                ? 'No capture sessions yet. Start a new session to begin field discovery.'
                : 'No sessions match the current filters.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
