import { getExecSession } from '@/lib/auth/exec-session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ExecInsightsView } from '@/components/executive/ExecInsightsView';

export default async function ExecInsightsPage() {
  const session = await getExecSession();
  if (!session) redirect('/executive');

  const scratchpad = await prisma.workshopScratchpad.findFirst({
    where: { workshop: { organizationId: session.execOrgId } },
    orderBy: { updatedAt: 'desc' },
    include: { workshop: { select: { name: true } } },
  });

  if (!scratchpad?.v2Output) {
    return <div className="text-white/40 text-center py-20">No insights available yet.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] text-[#5cf28e]/60 uppercase tracking-[0.3em] mb-2">Discovery Insights</p>
        <h1 className="text-3xl font-black text-white tracking-tight">{scratchpad.workshop?.name ?? 'Insights'}</h1>
      </div>
      <ExecInsightsView v2Output={scratchpad.v2Output as Record<string, unknown>} />
    </div>
  );
}
