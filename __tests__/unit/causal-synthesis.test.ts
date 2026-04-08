/**
 * Unit tests for causal-synthesis-agent deterministic extraction.
 *
 * Tests the exported extractFindings() function directly — no LLM calls.
 * Covers provenance alignment: evidenceNodeId and evidenceQuotes must
 * reference the same graph node.
 */

import { describe, it, expect } from 'vitest';
import { extractFindings } from '@/lib/output-intelligence/agents/causal-synthesis-agent';
import type { GraphIntelligence } from '@/lib/output/relationship-graph';

// ── Minimal GraphIntelligence fixtures ───────────────────────────────────────

function emptyGraph(): GraphIntelligence {
  return {
    dominantCausalChains: [],
    bottlenecks: [],
    compensatingBehaviours: [],
    brokenChains: [],
    contradictionPaths: [],
    summary: {
      totalChains: 0,
      totalBottlenecks: 0,
      totalCompensatingBehaviours: 0,
      totalBrokenChains: 0,
      totalContradictions: 0,
      systemicEdgeCount: 0,
      graphCoverageScore: 50,
    },
    clusterQuotes: {},
  };
}

// ── Blocker 4: compensating-behaviour quote provenance ────────────────────────

describe('extractFindings — compensating-behaviour provenance alignment', () => {
  it('evidenceNodeId and evidenceQuotes reference the SAME node (enabler)', () => {
    const graph: GraphIntelligence = {
      ...emptyGraph(),
      compensatingBehaviours: [
        {
          enablerNodeId:          'manual_workaround',
          enablerLabel:           'Manual workaround',
          constraintNodeId:       'old_system',
          constraintLabel:        'Old system',
          edgeId:                 'manual_workaround__compensates_for__old_system',
          constraintIsLive:       true,
          constraintRawFrequency: 8,
          riskLevel:              'high',
        },
      ],
      clusterQuotes: {
        manual_workaround: [
          { text: 'We log everything in a spreadsheet', participantRole: 'Agent', lens: null },
        ],
        old_system: [
          { text: 'The system is too slow to use', participantRole: 'Agent', lens: null },
        ],
      },
    };

    const findings = extractFindings(graph, 'TestCo');

    const cbFinding = findings.find(
      (f) => f.category === 'ORGANISATIONAL_ISSUE' && f.issueTitle.includes('Manual workaround'),
    );

    expect(cbFinding).toBeDefined();
    // evidenceNodeId must point to the enabler (the workaround node)
    expect(cbFinding!.evidenceNodeId).toBe('manual_workaround');
    // evidenceQuotes must come from the SAME node as evidenceNodeId
    expect(cbFinding!.evidenceQuotes).toBeDefined();
    expect(cbFinding!.evidenceQuotes![0].text).toBe('We log everything in a spreadsheet');
    // Constraint node's quote must NOT appear in evidenceQuotes (wrong node)
    const quoteTexts = cbFinding!.evidenceQuotes?.map((q) => q.text) ?? [];
    expect(quoteTexts).not.toContain('The system is too slow to use');
  });

  it('REINFORCED_FINDING compensating behaviour also aligns quotes with enabler', () => {
    const graph: GraphIntelligence = {
      ...emptyGraph(),
      compensatingBehaviours: [
        {
          enablerNodeId:          'interim_tool',
          enablerLabel:           'Interim tool',
          constraintNodeId:       'legacy_process',
          constraintLabel:        'Legacy process',
          edgeId:                 'interim_tool__compensates_for__legacy_process',
          constraintIsLive:       false,
          constraintRawFrequency: 3,
          riskLevel:              'medium',
        },
      ],
      clusterQuotes: {
        interim_tool:    [{ text: 'We use the interim tool as a workaround', participantRole: 'Manager', lens: null }],
        legacy_process:  [{ text: 'Legacy process is the root issue', participantRole: 'Manager', lens: null }],
      },
    };

    const findings = extractFindings(graph, 'TestCo');

    const cbFinding = findings.find(
      (f) => f.category === 'REINFORCED_FINDING' && f.issueTitle.includes('Interim tool'),
    );

    expect(cbFinding).toBeDefined();
    expect(cbFinding!.evidenceNodeId).toBe('interim_tool');
    expect(cbFinding!.evidenceQuotes?.[0].text).toBe('We use the interim tool as a workaround');
    expect(cbFinding!.evidenceQuotes?.map((q) => q.text)).not.toContain('Legacy process is the root issue');
  });
});

// ── causalChain population ────────────────────────────────────────────────────

describe('extractFindings — causalChain population', () => {
  it('populates causalChain on bottleneck finding when node appears in a dominantCausalChain', () => {
    const graph: GraphIntelligence = {
      ...emptyGraph(),
      dominantCausalChains: [
        {
          constraintNodeId:          'approval_delay',
          enablerNodeId:             'digital_tools',
          reimaginationNodeId:       'self_service',
          constraintToEnablerEdgeId: 'digital_tools__responds_to__approval_delay',
          enablerToReimagEdgeId:     'digital_tools__enables__self_service',
          chainStrength:             58,
          weakestLinkTier:           'REINFORCED',
          labels: { constraint: 'approval delay', enabler: 'digital tools', reimagination: 'self service' },
        },
      ],
      bottlenecks: [
        {
          nodeId:        'approval_delay',
          displayLabel:  'approval delay',
          layer:         'CONSTRAINT',
          outDegree:     3,
          affectedNodeIds: ['digital_tools', 'x', 'y'],
          edgeIds:       ['e1', 'e2', 'e3'],
          compositeScore: 65,
          evidenceTier:  'REINFORCED',
        },
      ],
      clusterQuotes: {
        approval_delay: [{ text: 'Approvals take 3 days minimum', participantRole: 'Agent', lens: null }],
      },
    };

    const findings = extractFindings(graph, 'TestCo');

    const bottleneckFinding = findings.find(
      (f) => f.category === 'ORGANISATIONAL_ISSUE' && f.evidenceNodeId === 'approval_delay',
    );

    expect(bottleneckFinding).toBeDefined();
    expect(bottleneckFinding!.causalChain).toBeDefined();
    expect(bottleneckFinding!.causalChain!.constraintLabel).toBe('approval delay');
    expect(bottleneckFinding!.causalChain!.enablerLabel).toBe('digital tools');
    expect(bottleneckFinding!.causalChain!.reimaginationLabel).toBe('self service');
    expect(bottleneckFinding!.causalChain!.chainStrength).toBe(58);
  });

  it('causalChain is undefined for a bottleneck not in any dominantCausalChain', () => {
    const graph: GraphIntelligence = {
      ...emptyGraph(),
      dominantCausalChains: [],
      bottlenecks: [
        {
          nodeId: 'isolated_constraint',
          displayLabel: 'isolated constraint',
          layer: 'CONSTRAINT',
          outDegree: 3,
          affectedNodeIds: ['a', 'b', 'c'],
          edgeIds: ['e1', 'e2', 'e3'],
          compositeScore: 55,
          evidenceTier: 'REINFORCED',
        },
      ],
      clusterQuotes: {},
    };

    const findings = extractFindings(graph, 'TestCo');
    const bottleneckFinding = findings.find((f) => f.evidenceNodeId === 'isolated_constraint');
    expect(bottleneckFinding).toBeDefined();
    expect(bottleneckFinding!.causalChain).toBeUndefined();
  });
});
