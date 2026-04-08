import { getExecSession } from '@/lib/auth/exec-session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

const HORIZON_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  now:   { bg: 'rgba(92,242,142,0.08)',  text: '#5cf28e',  border: 'rgba(92,242,142,0.25)',  label: 'Now — Weeks 1–4'   },
  next:  { bg: 'rgba(242,198,92,0.08)',  text: '#f2c65c',  border: 'rgba(242,198,92,0.25)',  label: 'Next — Weeks 5–12' },
  later: { bg: 'rgba(92,198,242,0.08)',  text: '#5cc6f2',  border: 'rgba(92,198,242,0.25)',  label: 'Later — Weeks 13–52' },
};

interface PathStep {
  horizon: string;
  action: string;
  constraintAddressed?: string;
  owner?: string;
  expectedImpact?: string;
  journeyStage?: string;
}

export default async function ExecRoadmapPage() {
  const session = await getExecSession();
  if (!session) redirect('/executive');

  const scratchpad = await prisma.workshopScratchpad.findFirst({
    where: { workshop: { organizationId: session.execOrgId } },
    orderBy: { updatedAt: 'desc' },
    include: { workshop: { select: { name: true } } },
  });

  if (!scratchpad?.v2Output) {
    return <div className="text-white/40 text-center py-20">No roadmap available yet.</div>;
  }

  const v2 = scratchpad.v2Output as Record<string, unknown>;
  const pathForward = v2?.pathForward as { execSummary?: string; steps?: PathStep[] } | undefined;
  const steps = pathForward?.steps ?? [];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] text-[#5cf28e]/60 uppercase tracking-[0.3em] mb-2">Implementation Roadmap</p>
        <h1 className="text-3xl font-black text-white tracking-tight">{scratchpad.workshop?.name ?? 'Roadmap'}</h1>
      </div>

      {pathForward?.execSummary && (
        <div className="border border-[#5cf28e]/20 rounded-2xl p-5 bg-[#5cf28e]/[0.04]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#5cf28e]" />
            <p className="text-[10px] text-[#5cf28e]/60 uppercase tracking-[0.2em]">Executive Summary</p>
          </div>
          <p className="text-white/65 text-sm leading-relaxed">{pathForward.execSummary}</p>
        </div>
      )}

      {/* Now / Next / Later boards */}
      <div className="grid lg:grid-cols-3 gap-6">
        {(['now', 'next', 'later'] as const).map(horizon => {
          const horizonSteps = steps.filter(s => s.horizon === horizon);
          const style = HORIZON_STYLE[horizon];
          return (
            <div key={horizon}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full" style={{ background: style.text }} />
                <h3 className="text-sm font-bold" style={{ color: style.text }}>{style.label}</h3>
                <span className="text-xs text-white/20 ml-auto">{horizonSteps.length}</span>
              </div>
              <div className="space-y-3">
                {horizonSteps.length === 0 && (
                  <p className="text-xs text-white/20 px-1">No initiatives in this horizon.</p>
                )}
                {horizonSteps.map((s, i) => (
                  <div key={i} className="rounded-xl p-4 border" style={{ background: style.bg, borderColor: style.border }}>
                    <p className="text-white/90 text-sm font-medium leading-snug mb-2">{s.action}</p>
                    {s.owner && (
                      <p className="text-xs mb-1" style={{ color: `${style.text}70` }}>
                        Owner: {s.owner}
                      </p>
                    )}
                    {s.constraintAddressed && (
                      <p className="text-xs text-white/25 leading-relaxed mb-1">
                        Addresses: {s.constraintAddressed}
                      </p>
                    )}
                    {s.expectedImpact && (
                      <p className="text-xs text-white/30 leading-relaxed">{s.expectedImpact}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
