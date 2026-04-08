import { getExecSession } from '@/lib/auth/exec-session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { HealthScoreRing } from '@/components/executive/HealthScoreRing';
import { MetricCard } from '@/components/executive/MetricCard';
import { PatternArchetypeCard } from '@/components/executive/PatternArchetypeCard';
import { TopFindingsPanel } from '@/components/executive/TopFindingsPanel';

function deriveHealthScore(v2Output: Record<string, unknown>): number {
  const discover = v2Output?.discover as { truths?: Array<{ evidenceStrength?: string }> } | undefined;
  const truths = discover?.truths ?? [];
  if (!truths.length) return 0;
  const map: Record<string, number> = { strong: 1.0, moderate: 0.67, weak: 0.33 };
  const avg = truths.reduce((s, t) => s + (map[t.evidenceStrength ?? 'weak'] ?? 0.33), 0) / truths.length;
  return Math.round(avg * 100);
}

export default async function ExecDashboardPage() {
  const session = await getExecSession();
  if (!session) redirect('/executive');

  const scratchpad = await prisma.workshopScratchpad.findFirst({
    where: { workshop: { organizationId: session.execOrgId } },
    orderBy: { updatedAt: 'desc' },
    include: { workshop: { select: { name: true, scheduledDate: true } } },
  });

  if (!scratchpad?.v2Output) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-white/40 text-lg mb-2">Your insights are being prepared.</p>
          <p className="text-white/20 text-sm">Check back shortly after your DREAM session is complete.</p>
        </div>
      </div>
    );
  }

  const v2 = scratchpad.v2Output as Record<string, unknown>;
  const outcomes = ((v2?.outcomes as { items?: unknown[] })?.items ?? []) as Array<{
    outcome: string; baseline: string; target: string; metric?: string;
  }>;
  const truths = ((v2?.discover as { truths?: unknown[] })?.truths ?? []) as Array<{
    statement: string; actor?: string; lens?: string; evidenceStrength?: string; whyItMatters?: string;
  }>;
  const healthScore = deriveHealthScore(v2);

  // Pattern from outputAssessment if available, else derive from constraints
  const assessment = scratchpad.outputAssessment as Record<string, unknown> | null;
  const patternName: string = (assessment?.patternName as string) ?? 'Your Transformation Profile';
  const patternHeadline: string = (assessment?.headline as string) ?? '';
  const patternInsight: string = (assessment?.insight as string) ?? '';
  const dreamFocus: string = (assessment?.dreamFocus as string) ?? '';

  const workshopDate = scratchpad.workshop?.scheduledDate
    ? new Date(scratchpad.workshop.scheduledDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] text-[#5cf28e]/60 uppercase tracking-[0.3em] mb-2">DREAM Discovery</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          {scratchpad.workshop?.name ?? 'Your Results'}
        </h1>
        {workshopDate && <p className="text-white/25 text-sm mt-1">{workshopDate}</p>}
      </div>

      {/* Top row: health score + pattern */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-6 flex items-center justify-center">
          <HealthScoreRing score={healthScore} />
        </div>

        <div className="lg:col-span-2">
          <PatternArchetypeCard
            name={patternName}
            headline={patternHeadline}
            insight={patternInsight}
            dreamFocus={dreamFocus}
          />
        </div>
      </div>

      {/* Outcome metrics */}
      {outcomes.length > 0 && (
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-[0.2em] mb-4">Target Outcomes</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {outcomes.slice(0, 4).map((o, i) => (
              <MetricCard
                key={i}
                label={o.outcome}
                baseline={o.baseline}
                target={o.target}
                metric={o.metric}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top findings */}
      {truths.length > 0 && (
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-[0.2em] mb-4">Key Findings</p>
          <TopFindingsPanel truths={truths} />
        </div>
      )}
    </div>
  );
}
