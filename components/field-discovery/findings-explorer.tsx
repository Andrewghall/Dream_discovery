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
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  AlertTriangle,
  Loader2,
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

interface EditFormState {
  title: string;
  description: string;
  severityScore: number;
  lens: string;
  type: string;
}

interface AddFormState {
  title: string;
  description: string;
  severityScore: number;
  lens: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LENSES = ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'];
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

function deriveLensOptions(findings: FindingItem[]): string[] {
  const fromData = Array.from(new Set(findings.map((f) => f.lens).filter(Boolean)));
  const merged = new Set([...DEFAULT_LENSES, ...fromData]);
  return Array.from(merged);
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

  // Edit state
  const [editingFinding, setEditingFinding] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    title: '',
    description: '',
    severityScore: 5,
    lens: 'People',
    type: 'CONSTRAINT',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deletingFinding, setDeletingFinding] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  // Add state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>({
    title: '',
    description: '',
    severityScore: 5,
    lens: 'People',
    type: 'CONSTRAINT',
  });
  const [addSaving, setAddSaving] = useState(false);

  // Re-synthesis state
  const [needsResynthesis, setNeedsResynthesis] = useState(false);
  const [resynthesising, setResynthesising] = useState(false);

  // Local findings for optimistic updates
  const [localFindings, setLocalFindings] = useState<FindingItem[] | null>(null);
  const activeFindings = localFindings ?? findings;

  // Derive lens options from actual data
  const lensOptions = useMemo(() => deriveLensOptions(activeFindings), [activeFindings]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...activeFindings];

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
  }, [activeFindings, streamFilter, lensFilter, typeFilter, minSeverity, sortField, sortDir]);

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

  // ---- Edit handlers ----

  function startEditing(finding: FindingItem) {
    setEditingFinding(finding.id);
    setEditForm({
      title: finding.title,
      description: finding.description ?? '',
      severityScore: finding.severityScore ?? 5,
      lens: finding.lens,
      type: finding.type,
    });
  }

  function cancelEditing() {
    setEditingFinding(null);
  }

  async function saveEdit(findingId: string) {
    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/findings/${findingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editForm.title,
            description: editForm.description,
            severityScore: editForm.severityScore,
            lens: editForm.lens,
            type: editForm.type,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to update finding');
      }
      const { finding: updated } = await res.json();

      // Optimistic update
      setLocalFindings((prev) => {
        const base = prev ?? findings;
        return base.map((f) =>
          f.id === findingId
            ? {
                ...f,
                title: updated.title ?? editForm.title,
                description: updated.description ?? editForm.description,
                severityScore: updated.severityScore ?? editForm.severityScore,
                lens: updated.lens ?? editForm.lens,
                type: updated.type ?? editForm.type,
              }
            : f
        );
      });

      setEditingFinding(null);
      setNeedsResynthesis(true);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save finding edit:', err);
      alert(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  }

  // ---- Delete handlers ----

  async function confirmDelete(findingId: string) {
    setDeleteInProgress(true);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/findings/${findingId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to delete finding');
      }

      // Optimistic removal
      setLocalFindings((prev) => {
        const base = prev ?? findings;
        return base.filter((f) => f.id !== findingId);
      });

      setDeletingFinding(null);
      setNeedsResynthesis(true);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete finding:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete finding');
    } finally {
      setDeleteInProgress(false);
    }
  }

  // ---- Add handlers ----

  function resetAddForm() {
    setAddForm({
      title: '',
      description: '',
      severityScore: 5,
      lens: 'People',
      type: 'CONSTRAINT',
    });
    setShowAddForm(false);
  }

  async function saveNewFinding() {
    if (!addForm.title.trim()) {
      alert('Title is required');
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/findings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: addForm.title.trim(),
            description: addForm.description.trim(),
            severityScore: addForm.severityScore,
            lens: addForm.lens,
            type: addForm.type,
            sourceStream: 'STREAM_B',
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to create finding');
      }
      const { finding: created } = await res.json();

      // Optimistic add
      const newFinding: FindingItem = {
        id: created.id,
        sourceStream: created.sourceStream ?? 'STREAM_B',
        lens: created.lens ?? addForm.lens,
        type: created.type ?? addForm.type,
        title: created.title ?? addForm.title,
        description: created.description ?? addForm.description,
        severityScore: created.severityScore ?? addForm.severityScore,
        frequencyCount: created.frequencyCount ?? 1,
        roleCoverage: created.roleCoverage ?? [],
        supportingQuotes: created.supportingQuotes ?? null,
        confidenceScore: created.confidenceScore ?? null,
        createdAt: created.createdAt ?? new Date().toISOString(),
      };

      setLocalFindings((prev) => {
        const base = prev ?? findings;
        return [newFinding, ...base];
      });

      resetAddForm();
      setNeedsResynthesis(true);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to create finding:', err);
      alert(err instanceof Error ? err.message : 'Failed to create finding');
    } finally {
      setAddSaving(false);
    }
  }

  // ---- Re-synthesis handler ----

  async function triggerResynthesis() {
    setResynthesising(true);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/diagnostic-synthesis`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Synthesis failed');
      }
      setNeedsResynthesis(false);
      onRefresh?.();
    } catch (err) {
      console.error('Re-synthesis failed:', err);
      alert(err instanceof Error ? err.message : 'Re-synthesis failed');
    } finally {
      setResynthesising(false);
    }
  }

  // Empty state
  if (activeFindings.length === 0 && !showAddForm) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No findings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Findings will appear here after capture sessions are analysed.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Finding
            </Button>
          </CardContent>
        </Card>

        {/* Add form in empty state */}
        {showAddForm && (
          <Card className="border-dashed border-2 border-primary/30">
            <CardContent className="pt-6">
              <AddFindingForm
                form={addForm}
                setForm={setAddForm}
                lensOptions={lensOptions}
                saving={addSaving}
                onSave={saveNewFinding}
                onCancel={resetAddForm}
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Re-synthesis banner */}
      {needsResynthesis && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm flex-1">
            Findings changed. Re-synthesise to update analysis.
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={resynthesising}
            onClick={triggerResynthesis}
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            {resynthesising ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                Re-synthesise
              </>
            )}
          </Button>
        </div>
      )}

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
                  {lensOptions.map((lens) => (
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

            {/* Spacer + actions */}
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
              disabled={showAddForm}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Finding
            </Button>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add finding form */}
      {showAddForm && (
        <Card className="border-dashed border-2 border-primary/30">
          <CardContent className="pt-6">
            <AddFindingForm
              form={addForm}
              setForm={setAddForm}
              lensOptions={lensOptions}
              saving={addSaving}
              onSave={saveNewFinding}
              onCancel={resetAddForm}
            />
          </CardContent>
        </Card>
      )}

      {/* Summary line */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
        <Search className="h-3.5 w-3.5" />
        Showing {filtered.length} of {activeFindings.length} findings
      </div>

      {/* Findings list */}
      <div className="space-y-2">
        {/* Sort header */}
        <div className="grid grid-cols-[24px_1fr_90px_100px_70px_70px_90px_68px] gap-2 items-center px-3 py-2 text-xs font-medium text-muted-foreground border-b">
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
          const isEditing = editingFinding === finding.id;
          const isDeleting = deletingFinding === finding.id;
          const severityScore = finding.severityScore ?? 0;
          const severityWidth = Math.max((severityScore / 10) * 100, 4);

          return (
            <Card key={finding.id} className="overflow-hidden">
              {/* Delete confirmation banner */}
              {isDeleting && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border-b border-red-200 text-red-800">
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className="text-sm flex-1">Delete this finding?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteInProgress}
                    onClick={() => confirmDelete(finding.id)}
                  >
                    {deleteInProgress ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : null}
                    Yes, delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deleteInProgress}
                    onClick={() => setDeletingFinding(null)}
                  >
                    No
                  </Button>
                </div>
              )}

              {/* Main row */}
              <div
                className="w-full grid grid-cols-[24px_1fr_90px_100px_70px_70px_90px_68px] gap-2 items-center px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors cursor-pointer"
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

                {/* Action icons */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Edit finding"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(finding);
                      if (!isExpanded) toggleExpand(finding.id);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-red-100 transition-colors text-muted-foreground hover:text-red-600"
                    title="Delete finding"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingFinding(finding.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded detail / edit mode */}
              {isExpanded && (
                <CardContent className="pt-0 pb-4 border-t bg-muted/30">
                  {isEditing ? (
                    <div className="space-y-4 pt-3">
                      {/* Title input */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Title
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          value={editForm.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>

                      {/* Description textarea */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Description
                        </label>
                        <textarea
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, description: e.target.value }))
                          }
                        />
                      </div>

                      {/* Row of dropdowns */}
                      <div className="flex flex-wrap items-end gap-3">
                        {/* Severity */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            Severity (1-10)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            className="w-[80px] px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            value={editForm.severityScore}
                            onChange={(e) => {
                              const val = Math.min(10, Math.max(1, Number(e.target.value) || 1));
                              setEditForm((f) => ({ ...f, severityScore: val }));
                            }}
                          />
                        </div>

                        {/* Lens */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-muted-foreground">Lens</label>
                          <Select
                            value={editForm.lens}
                            onValueChange={(v) => setEditForm((f) => ({ ...f, lens: v }))}
                          >
                            <SelectTrigger className="w-[150px]" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {lensOptions.map((lens) => (
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

                        {/* Type */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-muted-foreground">Type</label>
                          <Select
                            value={editForm.type}
                            onValueChange={(v) => setEditForm((f) => ({ ...f, type: v }))}
                          >
                            <SelectTrigger className="w-[160px]" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t.charAt(0) + t.slice(1).toLowerCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={editSaving || !editForm.title.trim()}
                          onClick={() => saveEdit(finding.id)}
                        >
                          {editSaving ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={editSaving}
                          onClick={cancelEditing}
                        >
                          <X className="h-3.5 w-3.5 mr-1.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* No results after filtering */}
      {filtered.length === 0 && activeFindings.length > 0 && (
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

// ---------------------------------------------------------------------------
// Add Finding Form (extracted for reuse in empty state and normal state)
// ---------------------------------------------------------------------------

function AddFindingForm({
  form,
  setForm,
  lensOptions,
  saving,
  onSave,
  onCancel,
}: {
  form: AddFormState;
  setForm: React.Dispatch<React.SetStateAction<AddFormState>>;
  lensOptions: string[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">New Finding</p>

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Finding title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Description
        </label>
        <textarea
          className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
          placeholder="Describe the finding..."
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      {/* Row of fields */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Severity */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Severity (1-10)</label>
          <input
            type="number"
            min={1}
            max={10}
            className="w-[80px] px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.severityScore}
            onChange={(e) => {
              const val = Math.min(10, Math.max(1, Number(e.target.value) || 1));
              setForm((f) => ({ ...f, severityScore: val }));
            }}
          />
        </div>

        {/* Lens */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Lens</label>
          <Select
            value={form.lens}
            onValueChange={(v) => setForm((f) => ({ ...f, lens: v }))}
          >
            <SelectTrigger className="w-[150px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lensOptions.map((lens) => (
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

        {/* Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <Select
            value={form.type}
            onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
          >
            <SelectTrigger className="w-[160px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          disabled={saving || !form.title.trim()}
          onClick={onSave}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5 mr-1.5" />
          )}
          Add Finding
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
