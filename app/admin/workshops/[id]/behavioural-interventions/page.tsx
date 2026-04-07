import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { BehaviouralInterventionsClient } from './_components/BehaviouralInterventionsClient';
import type { BehaviouralInterventionsOutput } from '@/lib/behavioural-interventions/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BehaviouralInterventionsPage({ params }: Props) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) redirect('/dream');

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) redirect('/admin');

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true, behaviouralInterventions: true },
  });

  if (!workshop) redirect('/admin');

  const stored = workshop.behaviouralInterventions
    ? (workshop.behaviouralInterventions as unknown as BehaviouralInterventionsOutput)
    : null;

  return (
    <div className="h-full overflow-auto bg-background">
      <BehaviouralInterventionsClient
        workshopId={workshopId}
        workshopName={workshop.name}
        initialData={stored}
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
    title: workshop ? `Behavioural Interventions — ${workshop.name}` : 'Behavioural Interventions',
  };
}
