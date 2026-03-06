import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { WorkshopSidebar } from '@/components/admin/workshop-sidebar';
import { IntelligenceHub } from '@/components/output-intelligence/IntelligenceHub';
import type { StoredOutputIntelligence } from '@/lib/output-intelligence/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function IntelligencePage({ params }: Props) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) redirect('/dream');

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) redirect('/admin');

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      name: true,
      domainPack: true,
      outputIntelligence: true,
    },
  });

  if (!workshop) redirect('/admin');

  const stored = workshop.outputIntelligence
    ? (workshop.outputIntelligence as unknown as StoredOutputIntelligence)
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <WorkshopSidebar
        workshopId={workshopId}
        workshopName={workshop.name}
        domainPack={workshop.domainPack}
      />
      <main className="flex-1 overflow-hidden">
        <IntelligenceHub
          workshopId={workshopId}
          initialStored={stored}
        />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id: workshopId } = await params;
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true },
  });
  return {
    title: workshop ? `Intelligence — ${workshop.name}` : 'Intelligence',
  };
}
