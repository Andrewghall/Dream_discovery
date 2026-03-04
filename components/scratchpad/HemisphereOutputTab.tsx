'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  DashboardHemisphereCanvas,
  type DashboardHemisphereNode,
  type DashboardHemisphereEdge,
} from '@/components/hemisphere/dashboard-hemisphere-canvas';

/**
 * HemisphereOutputTab
 *
 * Renders the hemisphere visualization as a read-only output tab
 * within the scratchpad dashboard. Fetches the latest hemisphere
 * graph data and renders it using the DashboardHemisphereCanvas.
 */

interface HemisphereOutputTabProps {
  workshopId: string;
}

interface HemisphereData {
  nodes: DashboardHemisphereNode[];
  edges: DashboardHemisphereEdge[];
  label: string;
  nodeCount: number;
  edgeCount: number;
  balanceLabel?: string;
  diagnostic?: {
    overallBalance?: number;
    postureSummary?: string;
  };
}

export function HemisphereOutputTab({ workshopId }: HemisphereOutputTabProps) {
  const [data, setData] = useState<HemisphereData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHemisphere() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/workshops/${workshopId}/hemisphere?source=latest`);
        if (!res.ok) {
          throw new Error(`Failed to load hemisphere data (${res.status})`);
        }
        const json = await res.json();
        if (json.graph) {
          setData({
            nodes: json.graph.nodes || [],
            edges: json.graph.edges || [],
            label: json.graph.label || 'Hemisphere',
            nodeCount: json.graph.nodes?.length || 0,
            edgeCount: json.graph.edges?.length || 0,
            balanceLabel: json.diagnostic?.sentimentIndex?.balanceLabel || undefined,
            diagnostic: {
              overallBalance: json.diagnostic?.balanceSafeguard?.overallBalance,
              postureSummary: json.diagnostic?.balanceSafeguard?.postureSummary,
            },
          });
        } else {
          setError('No hemisphere graph data available.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load hemisphere');
      } finally {
        setLoading(false);
      }
    }
    fetchHemisphere();
  }, [workshopId]);

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-3">Loading hemisphere visualization...</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">{error || 'No hemisphere data available.'}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Complete a live workshop session and save a snapshot to generate the hemisphere view.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Posture summary */}
      {data.diagnostic?.postureSummary && (
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Diagnostic Posture
              </span>
              <p className="text-sm text-slate-700 mt-1">{data.diagnostic.postureSummary}</p>
            </div>
            {data.diagnostic.overallBalance !== undefined && (
              <div className="text-right">
                <span className="text-xs text-slate-500">Balance Score</span>
                <p className="text-2xl font-bold text-slate-800">
                  {data.diagnostic.overallBalance}
                  <span className="text-sm font-normal text-slate-400">/100</span>
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Hemisphere canvas */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Workshop Hemisphere</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{data.nodeCount} nodes</span>
            <span>{data.edgeCount} edges</span>
            {data.balanceLabel && (
              <span className="px-2 py-0.5 bg-slate-100 rounded-full font-medium">
                {data.balanceLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-center">
          <DashboardHemisphereCanvas
            nodes={data.nodes}
            edges={data.edges}
            label={data.label}
            nodeCount={data.nodeCount}
            edgeCount={data.edgeCount}
            balanceLabel={data.balanceLabel}
            className="w-full max-w-2xl"
          />
        </div>
      </Card>

      {/* Layer legend */}
      <div className="flex justify-center gap-8 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span>H1: Imagine & Design</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span>H2: Transform & Enable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span>H3: Challenges & Constraints</span>
        </div>
      </div>
    </div>
  );
}
