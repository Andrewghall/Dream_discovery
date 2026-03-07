import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
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
    <div className="h-full overflow-hidden bg-background">
      <IntelligenceHub
        workshopId={workshopId}
        initialStored={stored}
      />
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
