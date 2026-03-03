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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaptureSessionSegment = {
  id: string;
  segmentIndex: number;
  status: string;
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
  onAnalyse,
  onResume,
}: {
  session: CaptureSessionItem;
  onAnalyse?: (id: string) => void;
  onResume?: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const captureLabel =
    CAPTURE_TYPE_LABELS[session.captureType] || session.captureType;
  const canAnalyse = session.status === 'TRANSCRIBED';
  const canResume =
    session.status === 'OPEN' || session.status === 'PAUSED';

  return (
    <div className="rounded-lg border">
      {/* Main row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
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

          {/* Segment list */}
          {session.segments.length > 0 ? (
            <div className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium">Segments</span>
              {(session.segments as CaptureSessionSegment[]).map((seg) => (
                <div
                  key={seg.id}
                  className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-xs"
                >
                  <span>Segment {seg.segmentIndex + 1}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${getStatusBadgeClass(seg.status)}`}
                  >
                    {seg.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mb-3 text-xs">
              No segments recorded yet
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
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
  workshopId: _workshopId,
  sessions,
  onAnalyse,
  onResume,
}: CaptureInboxProps) {
  const [filterType, setFilterType] = React.useState(ALL_FILTER);
  const [filterStatus, setFilterStatus] = React.useState(ALL_FILTER);
  const [filterRole, setFilterRole] = React.useState('');

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
        <CardTitle className="flex items-center gap-2 text-lg">
          <Inbox className="size-5" />
          Capture Sessions
          <Badge variant="secondary" className="ml-1">
            {sessions.length}
          </Badge>
        </CardTitle>
      </CardHeader>

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
              <SessionRow
                key={session.id}
                session={session}
                onAnalyse={onAnalyse}
                onResume={onResume}
              />
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
