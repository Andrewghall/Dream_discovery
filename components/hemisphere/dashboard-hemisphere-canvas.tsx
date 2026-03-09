'use client';

import { useEffect, useRef } from 'react';

/**
 * Display-only hemisphere canvas for the output dashboard.
 * Based on MiniHemisphere from the hemisphere page but scaled up
 * for dashboard display (~400px height) with wireframe guides and labels.
 *
 * No interaction handlers — purely presentational.
 */

// ── Types (local copies to avoid coupling to page.tsx) ──────────

type NodeType = 'VISION' | 'BELIEF' | 'CHALLENGE' | 'FRICTION' | 'CONSTRAINT' | 'ENABLER' | 'EVIDENCE';

export type DashboardHemisphereNode = {
  id: string;
  type: NodeType;
  label: string;
  weight: number;
  phaseTags: string[];
};

export type DashboardHemisphereEdge = {
  id: string;
  source: string;
  target: string;
  strength: number;
};

export interface DashboardHemisphereCanvasProps {
  nodes: DashboardHemisphereNode[];
  edges: DashboardHemisphereEdge[];
  coreTruthNodeId?: string;
  label: string;
  nodeCount: number;
  edgeCount?: number;
  balanceLabel?: string;
  className?: string;
}

// ── Utilities ────────────────────────────────────────────────

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Map node type → phi band (0=north pole, 1=south pole)
 *  H1 / ASPIRATION:  VISION, BELIEF       → top   0.04–0.28
 *  H2 / ENABLERS:    ENABLER, EVIDENCE    → middle 0.32–0.60
 *  H3 / FRICTION:    FRICTION, CONSTRAINT → bottom 0.64–0.95
 *  CHALLENGE sits in H2/H3 boundary for emphasis
 */
function phiBandForType(type: NodeType, jitter: number): number {
  switch (type) {
    case 'VISION':      return 0.04 + jitter * 0.22;   // top
    case 'BELIEF':      return 0.06 + jitter * 0.20;
    case 'ENABLER':     return 0.32 + jitter * 0.26;   // middle
    case 'EVIDENCE':    return 0.34 + jitter * 0.24;
    case 'CHALLENGE':   return 0.55 + jitter * 0.20;   // lower-middle
    case 'FRICTION':    return 0.64 + jitter * 0.28;   // bottom
    case 'CONSTRAINT':  return 0.68 + jitter * 0.26;
  }
}

function colorForType(type: NodeType): string {
  switch (type) {
    case 'VISION': return '#60a5fa';
    case 'BELIEF': return '#a78bfa';
    case 'CHALLENGE': return '#fb7185';
    case 'FRICTION': return '#f97316';
    case 'CONSTRAINT': return '#ef4444';
    case 'ENABLER': return '#34d399';
    case 'EVIDENCE': return '#94a3b8';
  }
}

// ── Component ────────────────────────────────────────────────

export function DashboardHemisphereCanvas({
  nodes,
  edges,
  coreTruthNodeId,
  label,
  nodeCount,
  edgeCount,
  balanceLabel,
  className = '',
}: DashboardHemisphereCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (tMs: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const cx = w / 2;
      const cy = h * 0.46;
      const R = Math.min(w, h) * 0.38;

      ctx.clearRect(0, 0, w, h);

      // Background — dark radial gradient
      const bg = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.4);
      bg.addColorStop(0, 'rgba(2,6,23,1)');
      bg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Wireframe sphere outline
      ctx.strokeStyle = 'rgba(148,163,184,0.12)';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Wireframe equator ellipse
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Wireframe horizontal rings at H1/H2/H3 boundaries
      const ringPositions = [0.28, 0.62]; // H1/H2 and H2/H3 boundaries
      for (const rp of ringPositions) {
        const ringY = cy - R * Math.cos(Math.PI * rp);
        const ringR = R * Math.sin(Math.PI * rp);
        ctx.beginPath();
        ctx.ellipse(cx, ringY, ringR, ringR * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Auto-rotation
      const spin = tMs * 0.00003;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);

      // Zone separator rings (H1/H2 and H2/H3 boundaries)
      const ZONE_PHI = [0.30, 0.62];
      ctx.strokeStyle = 'rgba(148,163,184,0.07)';
      ctx.lineWidth = dpr;
      for (const zp of ZONE_PHI) {
        const ringY = cy - R * Math.cos(Math.PI * zp);
        const ringR = R * Math.sin(Math.PI * zp);
        ctx.beginPath();
        ctx.ellipse(cx, ringY, ringR, ringR * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Zone labels (left side)
      const zones = [
        { phi: 0.15, label: 'ASPIRATION',  sub: 'Vision · Beliefs',  color: 'rgba(147,197,253,0.7)'  },
        { phi: 0.46, label: 'ENABLERS',    sub: 'Action · Change',   color: 'rgba(52,211,153,0.7)'   },
        { phi: 0.80, label: 'FRICTION',    sub: 'Constraints · Barriers', color: 'rgba(251,113,133,0.7)' },
      ];
      for (const z of zones) {
        const zy = cy - R * Math.cos(Math.PI * z.phi);
        const labelX = cx - R - 14 * dpr;
        ctx.globalAlpha = 0.75;
        ctx.font = `bold ${9 * dpr}px sans-serif`;
        ctx.fillStyle = z.color;
        ctx.textAlign = 'right';
        ctx.fillText('— ' + z.label, labelX, zy - 7 * dpr);
        ctx.font = `${8 * dpr}px sans-serif`;
        ctx.fillStyle = 'rgba(148,163,184,0.55)';
        ctx.fillText(z.sub, labelX, zy + 4 * dpr);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';

      // Draw edges first (thin lines, low opacity)
      if (edges.length > 0) {
        ctx.strokeStyle = 'rgba(148,163,184,0.06)';
        ctx.lineWidth = 0.5 * dpr;

        // Build position cache for edge rendering
        const posCache = new Map<string, { sx: number; sy: number; depth: number }>();
        for (const n of nodes) {
          if (n.id === coreTruthNodeId) continue;
          const u = hash01(`u:${n.id}`);
          const jitter = hash01(`j:${n.id}`);
          const theta = u * Math.PI * 2;
          const phi = Math.PI * clamp01(phiBandForType(n.type, jitter));
          const radial = Math.sin(phi);
          const py = Math.cos(phi);
          const px = Math.cos(theta) * radial;
          const pz = Math.sin(theta) * radial;
          const rx = px * cs - pz * sn;
          const rz = px * sn + pz * cs;
          const depth = (rz + 1) / 2;
          const persp = 0.7 + depth * 0.5;
          posCache.set(n.id, {
            sx: cx + rx * R * persp,
            sy: cy - py * R * persp,
            depth,
          });
        }

        // Draw a subset of edges (skip weak ones for performance)
        const maxEdges = Math.min(edges.length, 400);
        for (let i = 0; i < maxEdges; i++) {
          const e = edges[i];
          if (e.strength < 0.15) continue;
          const s = posCache.get(e.source);
          const t = posCache.get(e.target);
          if (!s || !t) continue;
          const alpha = 0.03 + Math.min(s.depth, t.depth) * 0.05;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(s.sx, s.sy);
          ctx.lineTo(t.sx, t.sy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Draw nodes
      for (const n of nodes) {
        if (n.id === coreTruthNodeId) continue;
        const u = hash01(`u:${n.id}`);
        const jitter = hash01(`j:${n.id}`);
        const theta = u * Math.PI * 2;
        const phi = Math.PI * clamp01(phiBandForType(n.type, jitter));
        const radial = Math.sin(phi);
        const py = Math.cos(phi);
        const px = Math.cos(theta) * radial;
        const pz = Math.sin(theta) * radial;

        const rx = px * cs - pz * sn;
        const rz = px * sn + pz * cs;
        const depth = (rz + 1) / 2;
        const persp = 0.7 + depth * 0.5;

        const sx = cx + rx * R * persp;
        const sy = cy - py * R * persp;
        const r = (1.2 + Math.sqrt(Math.max(1, n.weight || 1)) * 0.5) * dpr * persp;

        const alpha = 0.35 + depth * 0.55;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colorForType(n.type);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core truth node at center (if present)
      if (coreTruthNodeId && nodes.some(n => n.id === coreTruthNodeId)) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(cx, cy, 6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [nodes, edges, coreTruthNodeId]);

  return (
    <div className={`relative flex flex-col rounded-xl border border-white/10 bg-black/40 overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: 420 }}
      />
      {/* Label overlay */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-t border-white/5">
        <div>
          <div className="text-sm font-semibold text-slate-200">{label}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {nodeCount.toLocaleString()} nodes{edgeCount != null && ` · ${edgeCount.toLocaleString()} edges`}
          </div>
        </div>
        {balanceLabel && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            balanceLabel === 'aligned' || balanceLabel === 'innovation-dominated'
              ? 'bg-emerald-500/20 text-emerald-300'
              : balanceLabel === 'fragmented' || balanceLabel === 'defensive'
                ? 'bg-red-500/20 text-red-300'
                : 'bg-amber-500/20 text-amber-300'
          }`}>
            {balanceLabel.charAt(0).toUpperCase() + balanceLabel.slice(1)}
          </span>
        )}
      </div>
    </div>
  );
}
