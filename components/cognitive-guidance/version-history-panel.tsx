'use client';

import { useState } from 'react';
import { History, RotateCcw, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type VersionEntry = {
  id: string;
  version: number;
  dialoguePhase: string;
  label: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: VersionEntry[];
  currentVersion: number;
  isLive: boolean;
  onRestore: (versionId: string) => void;
  onLabel: (versionId: string, label: string) => void;
};

const PHASE_BADGE: Record<string, string> = {
  REIMAGINE: 'bg-blue-100 text-blue-700',
  CONSTRAINTS: 'bg-amber-100 text-amber-700',
  DEFINE_APPROACH: 'bg-emerald-100 text-emerald-700',
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatPhaseLabel(phase: string): string {
  return phase.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function VersionHistoryPanel({
  open,
  onOpenChange,
  versions,
  currentVersion,
  isLive,
  onRestore,
  onLabel,
}: Props) {
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  const handleRestore = (versionId: string) => {
    if (isLive) {
      setConfirmRestoreId(versionId);
    } else {
      onRestore(versionId);
      onOpenChange(false);
    }
  };

  const confirmRestore = () => {
    if (confirmRestoreId) {
      onRestore(confirmRestoreId);
      setConfirmRestoreId(null);
      onOpenChange(false);
    }
  };

  const startLabelEdit = (v: VersionEntry) => {
    setEditingLabelId(v.id);
    setLabelDraft(v.label || '');
  };

  const saveLabelEdit = () => {
    if (editingLabelId) {
      onLabel(editingLabelId, labelDraft);
      setEditingLabelId(null);
      setLabelDraft('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Session Version History
          </DialogTitle>
          <DialogDescription>
            {versions.length} version{versions.length !== 1 ? 's' : ''} saved. Restore any previous state.
          </DialogDescription>
        </DialogHeader>

        {/* Confirm restore overlay */}
        {confirmRestoreId && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800">
              Session is live. Restoring will overwrite current data.
            </p>
            <p className="text-xs text-amber-700">
              Stop the live session first for safest results.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmRestore}
                className="px-3 py-1 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Restore anyway
              </button>
              <button
                onClick={() => setConfirmRestoreId(null)}
                className="px-3 py-1 rounded-md text-xs font-medium border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Version list */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1 min-h-0">
          {versions.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No versions saved yet. Start a live session to begin auto-saving.
            </p>
          )}
          {versions.map((v) => {
            const isCurrent = v.version === currentVersion;
            return (
              <div
                key={v.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isCurrent ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                }`}
              >
                {/* Version number */}
                <span className={`text-xs font-mono font-bold w-8 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                  v{v.version}
                </span>

                {/* Phase badge */}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${PHASE_BADGE[v.dialoguePhase] || 'bg-gray-100 text-gray-600'}`}>
                  {formatPhaseLabel(v.dialoguePhase)}
                </span>

                {/* Label or time */}
                <div className="flex-1 min-w-0">
                  {editingLabelId === v.id ? (
                    <input
                      type="text"
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onBlur={saveLabelEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveLabelEdit(); if (e.key === 'Escape') setEditingLabelId(null); }}
                      autoFocus
                      placeholder="Add a label..."
                      className="w-full px-1.5 py-0.5 rounded border text-xs bg-background"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {v.label ? (
                        <span className="text-xs font-medium truncate">{v.label}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(v.createdAt)}</span>
                      )}
                      <button
                        onClick={() => startLabelEdit(v)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0"
                        title="Add label"
                      >
                        <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Time (when label exists) */}
                {v.label && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(v.createdAt)}
                  </span>
                )}

                {/* Restore / Reload button — always shown */}
                <button
                  onClick={() => handleRestore(v.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border hover:bg-muted/50 transition-colors shrink-0"
                  title={isCurrent ? 'Reload this session into the page' : 'Restore this version'}
                >
                  <RotateCcw className="h-3 w-3" />
                  {isCurrent ? 'Reload' : 'Restore'}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
