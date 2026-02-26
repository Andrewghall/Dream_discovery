import { prisma } from '@/lib/prisma';
import { WorkshopSidebar } from '@/components/admin/workshop-sidebar';

export default async function WorkshopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Lightweight query — just the name for the sidebar
  const workshop = await prisma.workshop.findUnique({
    where: { id },
    select: { name: true },
  });

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <WorkshopSidebar workshopId={id} workshopName={workshop?.name || 'Workshop'} />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
