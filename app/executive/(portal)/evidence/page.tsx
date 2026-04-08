import { getExecSession } from '@/lib/auth/exec-session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

const SIGNAL_STYLE: Record<string, { color: string; label: string }> = {
  green: { color: '#5cf28e', label: 'Positive Signal' },
  amber: { color: '#f2c65c', label: 'Mixed Signal'    },
  red:   { color: '#ef4444', label: 'Risk Signal'     },
  mixed: { color: '#f2955c', label: 'Mixed'           },
};

const CATEGORY_LABEL: Record<string, string> = {
  operational_report:      'Operational Report',
  performance_metrics:     'Performance Metrics',
  survey_data:             'Survey Data',
  customer_feedback:       'Customer Feedback',
  csat:                    'CSAT',
  nps:                     'NPS',
  social_media:            'Social Media',
  financial_data:          'Financial Data',
  process_documentation:   'Process Documentation',
  strategic_document:      'Strategic Document',
  audit_report:            'Audit Report',
  training_data:           'Training Data',
  incident_log:            'Incident Log',
  other:                   'Other',
};

interface CrossValidation {
  corroborated?: unknown[];
  contradicted?: unknown[];
  conclusionImpact?: string;
  perceptionGaps?: string[];
}

interface EvidenceDoc {
  id: string;
  originalFileName: string;
  sourceCategory: string | null;
  summary: string | null;
  signalDirection: string | null;
  confidence: number | null;
  crossValidation: unknown;
  createdAt: Date;
}

export default async function ExecEvidencePage() {
  const session = await getExecSession();
  if (!session) redirect('/executive');

  // Find the org's workshop
  const workshop = await prisma.workshop.findFirst({
    where: { organizationId: session.execOrgId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, evidenceSynthesis: true },
  });

  if (!workshop) {
    return <div className="text-white/40 text-center py-20">No workshop data available.</div>;
  }

  const docs: EvidenceDoc[] = await prisma.evidenceDocument.findMany({
    where: { workshopId: workshop.id, status: 'ready' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      originalFileName: true,
      sourceCategory: true,
      summary: true,
      signalDirection: true,
      confidence: true,
      crossValidation: true,
      createdAt: true,
    },
  });

  const synthesis = workshop.evidenceSynthesis as Record<string, unknown> | null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] text-[#5cf28e]/60 uppercase tracking-[0.3em] mb-2">Evidence Layer</p>
        <h1 className="text-3xl font-black text-white tracking-tight">{workshop.name}</h1>
        <p className="text-white/30 text-sm mt-1">{docs.length} evidence document{docs.length !== 1 ? 's' : ''} analysed</p>
      </div>

      {/* Synthesis summary */}
      {synthesis && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-6 space-y-4">
          <p className="text-[10px] text-[#5cf28e]/60 uppercase tracking-[0.3em]">Cross-Document Synthesis</p>
          {typeof synthesis.workshopLevelSummary === 'string' && synthesis.workshopLevelSummary.length > 0 && (
            <p className="text-white/65 text-sm leading-relaxed">{synthesis.workshopLevelSummary}</p>
          )}
          {Array.isArray(synthesis.sharedThemes) && synthesis.sharedThemes.length > 0 && (
            <div>
              <p className="text-xs text-white/25 mb-3">Themes across documents</p>
              <div className="flex flex-wrap gap-2">
                {(synthesis.sharedThemes as Array<{ theme: string; signalDirection?: string }>).map((t, i) => {
                  const sigColor = SIGNAL_STYLE[t.signalDirection ?? 'mixed']?.color ?? '#6b7280';
                  return (
                    <span key={i} className="text-xs px-3 py-1 rounded-full border"
                      style={{ borderColor: `${sigColor}40`, color: sigColor, background: `${sigColor}10` }}>
                      {t.theme}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evidence documents */}
      {docs.length === 0 && (
        <p className="text-white/30 text-sm">No evidence documents have been analysed yet.</p>
      )}
      <div className="space-y-4">
        {docs.map(doc => {
          const sig = SIGNAL_STYLE[doc.signalDirection ?? 'mixed'] ?? SIGNAL_STYLE.mixed;
          const cv = doc.crossValidation as CrossValidation | null;
          const confidencePct = doc.confidence != null ? Math.round(doc.confidence * 100) : null;
          return (
            <div key={doc.id} className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-white/80 text-sm font-medium">{doc.originalFileName}</p>
                  {doc.sourceCategory && (
                    <p className="text-xs text-white/30 mt-0.5">{CATEGORY_LABEL[doc.sourceCategory] ?? doc.sourceCategory}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {confidencePct != null && (
                    <div className="text-right">
                      <p className="text-xs font-bold" style={{ color: confidencePct >= 70 ? '#5cf28e' : confidencePct >= 45 ? '#f2c65c' : '#ef4444' }}>
                        {confidencePct}%
                      </p>
                      <p className="text-[9px] text-white/20">confidence</p>
                    </div>
                  )}
                  <span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full"
                    style={{ background: `${sig.color}15`, color: sig.color }}>
                    {sig.label}
                  </span>
                </div>
              </div>
              {doc.summary && <p className="text-white/45 text-xs leading-relaxed mb-3">{doc.summary}</p>}
              {cv?.conclusionImpact && (
                <p className="text-white/30 text-xs leading-relaxed border-t border-white/[0.06] pt-3">
                  <span className="text-white/20">Cross-validation: </span>{cv.conclusionImpact}
                </p>
              )}
              {cv?.contradicted && Array.isArray(cv.contradicted) && cv.contradicted.length > 0 && (
                <p className="text-red-400/50 text-xs mt-2">⚠ {cv.contradicted.length} contradiction{cv.contradicted.length !== 1 ? 's' : ''} with discovery findings</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
