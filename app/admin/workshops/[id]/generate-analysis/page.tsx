import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { GenerateAnalysisClient } from './_components/GenerateAnalysisClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GenerateAnalysisPage({ params }: Props) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) redirect('/dream');

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) redirect('/admin');

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true },
  });

  if (!workshop) redirect('/admin');

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Generate Full Analysis</h1>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Run all analysis pipelines for <span className="font-medium text-foreground">{workshop.name}</span> in
          the correct sequence — Discovery Synthesis, Output Intelligence, then Evidence (if uploaded).
        </p>
      </div>

      {/* Info callout */}
      <div className="mb-8 rounded-lg border border-border bg-muted/40 px-5 py-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">What this does</p>
        <ul className="list-disc list-inside space-y-0.5 mt-1">
          <li>
            <span className="font-medium text-foreground">Discovery Synthesis</span> — processes the live
            session snapshot into scratchpad sections and the visual insight map.
          </li>
          <li>
            <span className="font-medium text-foreground">Output Intelligence</span> — runs 5 parallel AI
            agents to generate strategic intelligence (Brain Scan).
          </li>
          <li>
            <span className="font-medium text-foreground">Evidence Cross-Validation</span> — validates
            uploaded evidence documents against workshop findings (skipped if none uploaded).
          </li>
          <li>
            <span className="font-medium text-foreground">Evidence Synthesis</span> — generates a
            cross-document synthesis report (requires ≥ 2 evidence documents).
          </li>
        </ul>
      </div>

      <GenerateAnalysisClient workshopId={workshopId} />
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
    title: workshop ? `Generate Analysis — ${workshop.name}` : 'Generate Analysis',
  };
}
