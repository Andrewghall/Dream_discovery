import { getExecSession } from '@/lib/auth/exec-session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { AskDreamChat } from '@/components/executive/AskDreamChat';

export default async function ExecAskPage() {
  const session = await getExecSession();
  if (!session) redirect('/executive');

  const org = await prisma.organization.findUnique({
    where: { id: session.execOrgId },
    select: { name: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] text-[#5cf28e]/60 uppercase tracking-[0.3em] mb-1">Agentic Intelligence</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Ask DREAM</h1>
      </div>
      <AskDreamChat orgName={org?.name ?? ''} />
    </div>
  );
}
