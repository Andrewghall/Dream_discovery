const STRENGTH_COLOR: Record<string, string> = {
  strong:   '#5cf28e',
  moderate: '#f2c65c',
  weak:     '#f2955c',
};

const LENS_COLOR: Record<string, string> = {
  People:       '#3b82f6',
  Organisation: '#22c55e',
  Customer:     '#a855f7',
  Technology:   '#f97316',
  Regulation:   '#ef4444',
};

interface Truth {
  statement: string;
  actor?: string;
  lens?: string;
  evidenceStrength?: string;
  whyItMatters?: string;
}

export function TopFindingsPanel({ truths }: { truths: Truth[] }) {
  if (!truths?.length) return null;

  return (
    <div className="space-y-3">
      {truths.slice(0, 3).map((t, i) => {
        const strengthColor = STRENGTH_COLOR[t.evidenceStrength ?? 'weak'] ?? '#5cf28e';
        const lensColor = LENS_COLOR[t.lens ?? ''] ?? '#6b7280';
        return (
          <div key={i} className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex gap-2 flex-wrap">
                {t.lens && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: `${lensColor}20`, color: lensColor }}>
                    {t.lens}
                  </span>
                )}
                {t.actor && (
                  <span className="text-[9px] text-white/30 px-2 py-0.5 rounded-full border border-white/[0.08]">
                    {t.actor}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: strengthColor, boxShadow: `0 0 4px ${strengthColor}` }} />
                <span className="text-[9px] capitalize" style={{ color: strengthColor }}>{t.evidenceStrength}</span>
              </div>
            </div>
            <p className="text-sm text-white/80 leading-relaxed mb-2">{t.statement}</p>
            {t.whyItMatters && (
              <p className="text-xs text-white/30 leading-relaxed">{t.whyItMatters}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
