/**
 * TLM Normalization Regression Tests
 *
 * Verifies that normalizeTLM / normalizeNode handle stale snapshot data
 * (nodes/edges missing fields added after initial creation) without throwing.
 * Regression for: TypeError: Cannot read properties of undefined (reading 'length')
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeTLM,
  normalizeNode,
  computePriorityNodes,
  buildWayForward,
  buildExecSummary,
} from '@/lib/output-intelligence/engines/priority-engine';
import type { TransformationLogicMap, TLMNode } from '@/lib/output-intelligence/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal stale node — only the fields that existed in the very first snapshot format */
function staleNode(overrides: Partial<TLMNode> = {}): Partial<TLMNode> {
  return {
    nodeId: 'node_001',
    displayLabel: 'Legacy Constraint',
    layer: 'CONSTRAINT',
    compositeScore: 0.4,
    // Intentionally missing: quotes, isOrphan, isCoalescent, inValidChain,
    // isCompensating, rawFrequency, connectionDegree, orphanType
    ...overrides,
  };
}

/** Minimal stale TLM — only fields from an early snapshot */
function staleTLM(overrides: Partial<TransformationLogicMap> = {}): Partial<TransformationLogicMap> {
  return {
    nodes: [staleNode() as TLMNode],
    edges: [],
    // Intentionally missing: coalescencePoints, orphanSummary, strongestChains,
    // coverageScore, interpretationSummary
    ...overrides,
  };
}

// ── normalizeNode ─────────────────────────────────────────────────────────────

describe('normalizeNode', () => {
  it('fills all missing boolean fields with false', () => {
    const result = normalizeNode(staleNode());
    expect(result.isCoalescent).toBe(false);
    expect(result.isOrphan).toBe(false);
    expect(result.inValidChain).toBe(false);
    expect(result.isCompensating).toBe(false);
  });

  it('fills missing numeric fields with 0', () => {
    const result = normalizeNode(staleNode());
    expect(result.rawFrequency).toBe(0);
    expect(result.connectionDegree).toBe(0);
  });

  it('fills missing quotes with empty array', () => {
    const result = normalizeNode(staleNode());
    expect(Array.isArray(result.quotes)).toBe(true);
    expect(result.quotes.length).toBe(0);
  });

  it('preserves quotes when present', () => {
    const result = normalizeNode(staleNode({ quotes: ['q1', 'q2'] }));
    expect(result.quotes).toEqual(['q1', 'q2']);
  });

  it('handles null input gracefully', () => {
    const result = normalizeNode({} as Partial<TLMNode>);
    expect(result.nodeId).toBe('');
    expect(result.displayLabel).toBe('');
    expect(result.layer).toBe('CONSTRAINT');
  });
});

// ── normalizeTLM ──────────────────────────────────────────────────────────────

describe('normalizeTLM', () => {
  it('handles null input', () => {
    const result = normalizeTLM(null);
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    expect(Array.isArray(result.coalescencePoints)).toBe(true);
    expect(Array.isArray(result.strongestChains)).toBe(true);
    expect(result.coverageScore).toBe(0);
    expect(result.interpretationSummary).toBe('');
  });

  it('handles undefined input', () => {
    const result = normalizeTLM(undefined);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('handles stale TLM missing optional arrays', () => {
    const result = normalizeTLM(staleTLM());
    expect(Array.isArray(result.coalescencePoints)).toBe(true);
    expect(Array.isArray(result.strongestChains)).toBe(true);
    expect(result.orphanSummary.constraintOrphans).toBe(0);
    expect(result.orphanSummary.topOrphanLabels).toHaveLength(0);
  });

  it('normalizes each node inside the TLM', () => {
    const result = normalizeTLM(staleTLM());
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].quotes).toEqual([]);
    expect(result.nodes[0].isOrphan).toBe(false);
    expect(result.nodes[0].rawFrequency).toBe(0);
  });

  it('.length on all arrays never throws', () => {
    const result = normalizeTLM(staleTLM());
    // These are the exact expressions that were crashing
    expect(() => result.nodes.length).not.toThrow();
    expect(() => result.edges.length).not.toThrow();
    expect(() => result.strongestChains.length).not.toThrow();
    expect(() => result.coalescencePoints.length).not.toThrow();
    expect(() => result.nodes[0].quotes.length).not.toThrow();
  });
});

// ── computePriorityNodes ──────────────────────────────────────────────────────

describe('computePriorityNodes', () => {
  it('does not crash on null TLM', () => {
    expect(() => computePriorityNodes(null as unknown as TransformationLogicMap)).not.toThrow();
  });

  it('does not crash on stale TLM with missing node fields', () => {
    const tlm = normalizeTLM(staleTLM({
      nodes: [
        staleNode({ nodeId: 'n1', layer: 'CONSTRAINT' }) as TLMNode,
        staleNode({ nodeId: 'n2', layer: 'ENABLER' }) as TLMNode,
        staleNode({ nodeId: 'n3', layer: 'VISION' }) as TLMNode,
      ],
    }));
    expect(() => computePriorityNodes(tlm)).not.toThrow();
  });

  it('returns at most 7 nodes', () => {
    const nodes = Array.from({ length: 20 }, (_, i) =>
      staleNode({ nodeId: `n${i}`, layer: 'CONSTRAINT', compositeScore: i * 0.05 }) as TLMNode
    );
    const tlm = normalizeTLM(staleTLM({ nodes }));
    const result = computePriorityNodes(tlm);
    expect(result.length).toBeLessThanOrEqual(7);
  });
});

// ── buildWayForward ───────────────────────────────────────────────────────────

describe('buildWayForward', () => {
  it('does not crash on null TLM', () => {
    expect(() => buildWayForward(null as unknown as TransformationLogicMap)).not.toThrow();
  });

  it('does not crash on stale TLM', () => {
    const tlm = normalizeTLM(staleTLM());
    expect(() => buildWayForward(tlm)).not.toThrow();
  });

  it('returns an array', () => {
    const tlm = normalizeTLM(staleTLM());
    const result = buildWayForward(tlm);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── buildExecSummary ──────────────────────────────────────────────────────────

describe('buildExecSummary', () => {
  it('does not crash on null TLM', () => {
    expect(() => buildExecSummary(null as unknown as TransformationLogicMap)).not.toThrow();
  });

  it('does not crash on stale TLM', () => {
    const tlm = normalizeTLM(staleTLM());
    expect(() => buildExecSummary(tlm)).not.toThrow();
  });
});
