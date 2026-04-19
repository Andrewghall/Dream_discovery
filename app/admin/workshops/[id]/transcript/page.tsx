import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const workshop = await prisma.workshop.findUnique({
    where: { id },
    select: { name: true, clientName: true },
  });
  if (!workshop) notFound();

  const deduped = await prisma.rawTranscriptEntry.findMany({
    where: { workshopId: id },
    orderBy: [{ sequence: 'asc' }, { startTimeMs: 'asc' }],
    select: {
      id: true,
      text: true,
      startTimeMs: true,
      speakerId: true,
    },
  });

  // Work out session start so we can show relative timestamps
  const sessionStart = deduped[0]?.startTimeMs ?? BigInt(0);
  const durationMs = deduped.length > 0
    ? Number(deduped[deduped.length - 1].startTimeMs) - Number(sessionStart)
    : 0;
  const durationMins = Math.round(durationMs / 60000);

  function relTime(ms: bigint): string {
    const elapsed = Number(ms) - Number(sessionStart);
    const m = Math.floor(elapsed / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Group consecutive chunks by speaker into runs for readability
  type Run = { speakerId: string | null; chunks: typeof deduped };
  const runs: Run[] = [];
  for (const c of deduped) {
    const last = runs[runs.length - 1];
    if (last && last.speakerId === c.speakerId) {
      last.chunks.push(c);
    } else {
      runs.push({ speakerId: c.speakerId, chunks: [c] });
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Full Transcript</h1>
        <p className="text-sm text-slate-500 mt-1">
          {workshop.clientName || workshop.name} — {deduped.length} segments · {durationMins} mins recorded
        </p>
      </div>

      {deduped.length === 0 ? (
        <div className="text-slate-400 text-sm">No transcript entries found for this workshop.</div>
      ) : (
        <div className="space-y-4">
          {runs.map((run, ri) => (
            <div key={ri} className="flex gap-4">
              {/* Speaker + timestamp */}
              <div className="w-24 shrink-0 pt-0.5 text-right">
                <span className="text-xs font-mono text-slate-400">
                  {relTime(run.chunks[0].startTimeMs)}
                </span>
                {run.speakerId && (
                  <div className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                    {run.speakerId}
                  </div>
                )}
              </div>
              {/* Text */}
              <div className="flex-1 bg-white border border-slate-100 rounded-lg px-4 py-3 text-sm text-slate-700 leading-relaxed shadow-sm">
                {run.chunks.map((c) => c.text).join(' ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
