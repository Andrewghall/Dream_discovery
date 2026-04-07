import { EvidenceTab } from '@/components/scratchpad/EvidenceTab';

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <EvidenceTab workshopId={id} />
    </div>
  );
}
