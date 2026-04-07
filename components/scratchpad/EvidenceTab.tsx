'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileSearch, BarChart3, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { EvidenceUploadZone } from '@/components/evidence/EvidenceUploadZone';
import { EvidenceDocumentCard } from '@/components/evidence/EvidenceDocumentCard';
import { CrossValidationPanel } from '@/components/evidence/CrossValidationPanel';
import { CrossDocSynthesisPanel } from '@/components/evidence/CrossDocSynthesisPanel';
import type { NormalisedEvidenceDocument, CrossValidationResult, CrossDocSynthesis, SignalDirection } from '@/lib/evidence/types';

interface EvidenceTabProps {
  workshopId: string;
}

const SIGNAL_LABELS: Record<SignalDirection, { label: string; icon: React.ReactNode; color: string }> = {
  red:   { label: 'Predominantly negative', icon: <TrendingDown className="h-4 w-4" />, color: 'text-red-600' },
  amber: { label: 'Mixed signals',           icon: <Minus className="h-4 w-4" />,        color: 'text-amber-600' },
  green: { label: 'Predominantly positive',  icon: <TrendingUp className="h-4 w-4" />,   color: 'text-green-600' },
  mixed: { label: 'Mixed signals',           icon: <Minus className="h-4 w-4" />,        color: 'text-slate-500' },
};

export function EvidenceTab({ workshopId }: EvidenceTabProps) {
  const [docs, setDocs] = useState<NormalisedEvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [crossValidation, setCrossValidation] = useState<CrossValidationResult | null>(null);
  const [synthesis, setSynthesis] = useState<CrossDocSynthesis | null>(null);

  // Load existing evidence documents
  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/evidence`);
      if (!res.ok) return;
      const body = await res.json();
      const shaped = (body.documents ?? []).map(shapedDoc);
      setDocs(shaped);
      // Always sync cross-validation from server — including null after invalidation
      const readyWithCV = shaped.find((d: NormalisedEvidenceDocument) => d.crossValidation);
      setCrossValidation((readyWithCV?.crossValidation as CrossValidationResult) ?? null);
      // Always sync synthesis from server — including null after invalidation
      setSynthesis((body.evidenceSynthesis as CrossDocSynthesis) ?? null);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [workshopId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUploadComplete = (results: Array<{ id: string; fileName: string; status: string }>) => {
    // Reload full doc list after upload
    loadDocs();
  };

  const handleDelete = (docId: string) => {
    setDocs(prev => prev.filter(d => d.id !== docId));
    // Synthesis and cross-validation are now stale — clear them locally
    setCrossValidation(null);
    setSynthesis(null);
  };

  const handleValidated = (result: CrossValidationResult) => {
    setCrossValidation(result);
  };

  const handleSynthesisComplete = (result: CrossDocSynthesis) => {
    setSynthesis(result);
  };

  const readyDocs = docs.filter(d => d.status === 'ready');
  const processingDocs = docs.filter(d => d.status === 'uploading' || d.status === 'processing');

  // Aggregate stats
  const totalFindings = readyDocs.reduce((acc, d) => acc + (d.findings?.length ?? 0), 0);
  const totalMetrics = readyDocs.reduce((acc, d) => acc + (d.metrics?.length ?? 0), 0);
  const signalBreakdown = readyDocs.reduce(
    (acc, d) => { if (d.signalDirection) acc[d.signalDirection] = (acc[d.signalDirection] ?? 0) + 1; return acc; },
    {} as Record<SignalDirection, number>
  );
  const dominantSignal = (Object.entries(signalBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed') as SignalDirection;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <FileSearch className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">Loading evidence…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <FileSearch className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900">Historical Evidence</h2>
        </div>
        <p className="text-sm text-slate-500">
          Upload any operational documents, reports, or data.
          The system interprets and normalises the content automatically.
        </p>
        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
          <div className="grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <p className="font-bold text-indigo-900">Discovery</p>
              <p className="text-indigo-600">What people said</p>
            </div>
            <div className="border-x border-indigo-200">
              <p className="font-bold text-indigo-900">Evidence</p>
              <p className="text-indigo-600">What data shows</p>
            </div>
            <div>
              <p className="font-bold text-indigo-900">Synthesis</p>
              <p className="text-indigo-600">Where they align or differ</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Add Evidence</h3>
        <EvidenceUploadZone
          workshopId={workshopId}
          onUploadComplete={handleUploadComplete}
          disabled={false}
        />
      </section>

      {/* Processing indicator */}
      {processingDocs.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-700">
            ⏳ {processingDocs.length} file{processingDocs.length > 1 ? 's' : ''} still processing…
          </p>
        </div>
      )}

      {/* Stats bar */}
      {readyDocs.length > 0 && (
        <section>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Sources uploaded"
              value={String(readyDocs.length)}
              sub={`${processingDocs.length > 0 ? processingDocs.length + ' processing' : 'all ready'}`}
              icon={<BarChart3 className="h-4 w-4 text-indigo-600" />}
            />
            <StatCard
              label="Findings extracted"
              value={String(totalFindings)}
              sub={`${totalMetrics} metrics`}
              icon={<FileSearch className="h-4 w-4 text-slate-600" />}
            />
            <StatCard
              label="Overall signal"
              value={SIGNAL_LABELS[dominantSignal].label}
              sub={`${signalBreakdown.red ?? 0} red · ${signalBreakdown.amber ?? 0} amber · ${signalBreakdown.green ?? 0} green`}
              icon={<span className={SIGNAL_LABELS[dominantSignal].color}>{SIGNAL_LABELS[dominantSignal].icon}</span>}
            />
          </div>
        </section>
      )}

      {/* Document cards */}
      {docs.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            What Each Source Says
            <span className="ml-2 text-xs font-normal text-slate-400">({docs.length} document{docs.length !== 1 ? 's' : ''})</span>
          </h3>
          <div className="space-y-3">
            {docs.map(doc => (
              <EvidenceDocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {docs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <FileSearch className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No evidence uploaded yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Upload reports, spreadsheets, or images above.<br />
            The system will extract and interpret the content automatically.
          </p>
        </div>
      )}

      {/* Cross-validation */}
      {docs.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <CrossValidationPanel
            workshopId={workshopId}
            crossValidation={crossValidation}
            hasReadyDocs={readyDocs.length > 0}
            onValidated={handleValidated}
          />
        </section>
      )}

      {/* Cross-document synthesis */}
      {docs.length > 0 && (
        <section>
          <CrossDocSynthesisPanel
            workshopId={workshopId}
            synthesis={synthesis}
            readyDocCount={readyDocs.length}
            onSynthesisComplete={handleSynthesisComplete}
          />
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

// Shape raw Prisma output into NormalisedEvidenceDocument
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapedDoc(d: any): NormalisedEvidenceDocument {
  return {
    ...d,
    findings: d.findings ?? [],
    metrics: d.metrics ?? [],
    excerpts: d.excerpts ?? [],
    relevantLenses: d.relevantLenses ?? [],
    relevantActors: d.relevantActors ?? [],
    relevantJourneyStages: d.relevantJourneyStages ?? [],
    signalDirection: d.signalDirection ?? 'mixed',
    sourceCategory: d.sourceCategory ?? 'other',
    summary: d.summary ?? '',
    confidence: d.confidence ?? 0.5,
    status: d.status ?? 'processing',
    createdAt: d.createdAt?.toISOString?.() ?? d.createdAt ?? new Date().toISOString(),
    updatedAt: d.updatedAt?.toISOString?.() ?? d.updatedAt ?? new Date().toISOString(),
  };
}
