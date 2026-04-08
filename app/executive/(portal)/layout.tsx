import { getExecSession } from '@/lib/auth/exec-session';
import { prisma } from '@/lib/prisma';
import { ExecNavbar } from '@/components/executive/ExecNavbar';
import { redirect } from 'next/navigation';

export default async function ExecPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getExecSession();
  if (!session) redirect('/executive');

  const org = await prisma.organization.findUnique({
    where: { id: session.execOrgId },
    select: { name: true },
  });

  return (
    <>
      <ExecNavbar name={session.name} orgName={org?.name ?? ''} />
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {children}
      </main>
    </>
  );
}
