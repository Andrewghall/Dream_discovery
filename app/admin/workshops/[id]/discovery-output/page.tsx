'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiscoveryOutputTab } from '@/components/scratchpad/DiscoveryOutputTab';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DiscoveryOutputPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [loading, setLoading] = useState(true);
  const [discoveryOutput, setDiscoveryOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [workshopName, setWorkshopName] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      try {
        const [scratchpadRes, workshopRes] = await Promise.all([
          fetch(`/api/admin/workshops/${workshopId}/scratchpad`),
          fetch(`/api/admin/workshops/${workshopId}`),
        ]);

        if (!scratchpadRes.ok) {
          throw new Error(`Failed to load data (HTTP ${scratchpadRes.status})`);
        }

        const scratchpadData = await scratchpadRes.json();
        const output = scratchpadData.scratchpad?.discoveryOutput;
        if (output && Object.keys(output).length > 0) {
          setDiscoveryOutput(output);
        }

        if (workshopRes.ok) {
          const workshopData = await workshopRes.json();
          setWorkshopName(workshopData.workshop?.name ?? '');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [workshopId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background px-6 py-3 flex items-center gap-3">
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <div>
          <h1 className="text-sm font-semibold">Discovery Output</h1>
          {workshopName && (
            <p className="text-xs text-muted-foreground">{workshopName}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && (
          <div className="flex justify-center mt-20">
            <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 max-w-md mx-auto mt-16">
            <p className="text-sm font-semibold text-red-700">Failed to load discovery output</p>
            <p className="text-xs text-red-600 font-mono mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && !discoveryOutput && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="rounded-full bg-muted p-4">
              <BarChart2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No discovery output yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run <strong>✦ Synthesise</strong> on the Insight Map to generate the
                domain-level analysis — radar chart, alignment heatmaps, friction points,
                word clouds, and consensus metrics.
              </p>
            </div>
            <Link href={`/admin/workshops/${workshopId}/hemisphere`}>
              <Button variant="outline" size="sm">Go to Insight Map</Button>
            </Link>
          </div>
        )}

        {!loading && !error && discoveryOutput && (
          <DiscoveryOutputTab data={discoveryOutput} />
        )}
      </div>
    </div>
  );
}
