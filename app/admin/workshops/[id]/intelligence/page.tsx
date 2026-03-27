import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { IntelligenceHub } from '@/components/output-intelligence/IntelligenceHub';
import type { StoredOutputIntelligence } from '@/lib/output-intelligence/types';
import type { V2Output } from '@/lib/output/v2-synthesis-agent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function IntelligencePage({ params }: Props) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) redirect('/dream');

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) redirect('/admin');

  const [workshop, scratchpad] = await Promise.all([
    prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { name: true, description: true, domainPack: true, outputIntelligence: true },
    }),
    prisma.workshopScratchpad.findUnique({
      where: { workshopId },
      select: { v2Output: true },
    }),
  ]);

  if (!workshop) redirect('/admin');

  const stored = workshop.outputIntelligence
    ? (workshop.outputIntelligence as unknown as StoredOutputIntelligence)
    : null;

  const v2Output = (scratchpad?.v2Output as V2Output | null) ?? null;

  return (
    <div className="h-full overflow-hidden bg-background">
      <IntelligenceHub
        workshopId={workshopId}
        initialStored={stored}
        v2Output={v2Output}
        workshopDescription={workshop.description}
        domainPack={workshop.domainPack}
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
