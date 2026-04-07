'use client';

import { FileText, ImageIcon, Table2, Presentation, ChevronDown, ChevronUp, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { NormalisedEvidenceDocument, NormalisedEvidenceFinding, EvidenceMetric } from '@/lib/evidence/types';

const SIGNAL_CONFIG = {
  red:   { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',   dot: 'bg-red-500',   label: 'Negative signals' },
  amber: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Mixed signals' },
  green: { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500', label: 'Positive signals' },
  mixed: { bg: 'bg-slate-50',  border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Mixed signals' },
};

const FINDING_SIGNAL = {
  red:   'text-red-600',
  amber: 'text-amber-600',
  green: 'text-green-600',
  mixed: 'text-slate-500',
};

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon className="h-5 w-5" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <Table2 className="h-5 w-5" />;
  if (['ppt', 'pptx'].includes(ext)) return <Presentation className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    operational_report: 'Operational Report',
    performance_metrics: 'Performance Metrics',
    survey_data: 'Survey Data',
    customer_feedback: 'Customer Feedback',
    csat: 'CSAT',
    nps: 'NPS',
    social_media: 'Social Media',
    financial_data: 'Financial Data',
    process_documentation: 'Process Documentation',
    strategic_document: 'Strategic Document',
    audit_report: 'Audit Report',
    training_data: 'Training Data',
    incident_log: 'Incident Log',
    other: 'Document',
  };
  return map[cat] ?? cat;
}

interface EvidenceDocumentCardProps {
  doc: NormalisedEvidenceDocument;
  onDelete: (docId: string) => void;
}

export function EvidenceDocumentCard({ doc, onDelete }: EvidenceDocumentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isProcessing = doc.status === 'uploading' || doc.status === 'processing';
  const isFailed = doc.status === 'failed';
  const isReady = doc.status === 'ready';

  const sig = isReady ? (SIGNAL_CONFIG[doc.signalDirection] ?? SIGNAL_CONFIG.mixed) : null;

  const handleDelete = async () => {
    if (!confirm(`Remove "${doc.originalFileName}" from evidence? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/admin/workshops/${doc.workshopId}/evidence?docId=${doc.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? `Delete failed (${res.status})`;
        console.error('[evidence] Delete failed:', msg);
        setDeleteError(msg);
        return;
      }
      // Only remove from parent state after confirmed server deletion
      onDelete(doc.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      console.error('[evidence] Delete error:', err);
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-all ${sig?.border ?? 'border-slate-200'}`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 rounded-lg p-2 ${sig?.bg ?? 'bg-slate-50'}`}>
          <span className={sig?.text ?? 'text-slate-500'}>{fileIcon(doc.originalFileName)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="truncate text-sm font-semibold text-slate-800">{doc.originalFileName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {isReady && doc.sourceCategory ? categoryLabel(doc.sourceCategory) : ''}
                {doc.timeframeFrom && ` · ${doc.timeframeFrom}${doc.timeframeTo ? ` – ${doc.timeframeTo}` : ''}`}
                {' · '}
                {formatSize(doc.fileSizeBytes)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Signal badge */}
              {isReady && sig && (
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${sig.bg} ${sig.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sig.dot}`} />
                  {sig.label}
                  {doc.confidence && ` · ${Math.round(doc.confidence * 100)}% conf`}
                </span>
              )}

              {/* Processing */}
              {isProcessing && (
                <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {doc.status === 'uploading' ? 'Uploading…' : 'Analysing…'}
                </span>
              )}

              {/* Failed */}
              {isFailed && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                  <AlertCircle className="h-3 w-3" />
                  Failed
                </span>
              )}

              {/* Delete */}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title="Remove evidence document"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>

              {/* Expand */}
              {isReady && (
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Summary */}
          {isReady && doc.summary && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{doc.summary}</p>
          )}

          {/* Error message */}
          {isFailed && doc.errorMessage && (
            <p className="mt-1 text-xs text-red-600">{doc.errorMessage}</p>
          )}

          {/* Delete error */}
          {deleteError && (
            <p className="mt-1 text-xs text-red-600">⚠ {deleteError}</p>
          )}

          {/* Relevant lenses */}
          {isReady && doc.relevantLenses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {doc.relevantLenses.map(l => (
                <span key={l} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && isReady && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
          {/* Key findings */}
          {doc.findings.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Key Findings</h4>
              <ul className="space-y-2">
                {doc.findings.map((f: NormalisedEvidenceFinding) => (
                  <li key={f.id} className="flex items-start gap-2">
                    <span className={`mt-0.5 text-xs font-bold ${FINDING_SIGNAL[f.signalDirection] ?? 'text-slate-400'}`}>
                      {f.signalDirection === 'red' ? '●' : f.signalDirection === 'green' ? '●' : '●'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">{f.text}</p>
                      {f.sourceExcerpt && (
                        <p className="mt-0.5 text-xs italic text-slate-400">"{f.sourceExcerpt.slice(0, 120)}"</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metrics */}
          {doc.metrics.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted Metrics</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {doc.metrics.map((m: EvidenceMetric, i) => (
                  <div key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">{m.name}</p>
                    <p className="mt-0.5 text-base font-semibold text-slate-800">
                      {m.value}{m.unit && <span className="text-sm font-normal text-slate-500"> {m.unit}</span>}
                    </p>
                    {m.trend && (
                      <p className={`text-xs mt-0.5 ${m.trend === 'declining' ? 'text-red-600' : m.trend === 'improving' ? 'text-green-600' : 'text-slate-500'}`}>
                        {m.trend === 'improving' ? '↑' : m.trend === 'declining' ? '↓' : '→'} {m.period ?? ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verbatim excerpts */}
          {doc.excerpts && doc.excerpts.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Verbatim Excerpts</h4>
              <div className="space-y-1.5">
                {doc.excerpts.slice(0, 3).map((ex: string, i) => (
                  <blockquote key={i} className="border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600">
                    "{ex}"
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
