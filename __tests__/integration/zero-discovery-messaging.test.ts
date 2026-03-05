/**
 * Zero-Discovery State Handling Tests
 *
 * Verifies that when zero Discovery interviews are completed:
 * - hasDiscoveryData returns false for empty/fallback briefings
 * - Orchestration messages do NOT contain contradictory success language
 * - Normal (non-zero) discovery path still works correctly
 */

import { describe, it, expect } from 'vitest';
import { hasDiscoveryData } from '@/lib/cognition/agents/agent-types';

// ================================================================
// 1. hasDiscoveryData helper
// ================================================================

describe('hasDiscoveryData', () => {
  it('returns false for null', () => {
    expect(hasDiscoveryData(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasDiscoveryData(undefined)).toBe(false);
  });

  it('returns false for fallback intelligence (all empty, participantCount=0)', () => {
    expect(hasDiscoveryData({
      maturitySnapshot: [],
      discoveryThemes: [],
      consensusAreas: [],
      divergenceAreas: [],
      painPoints: [],
      aspirations: [],
      watchPoints: [],
      participantCount: 0,
      synthesizedAtMs: Date.now(),
      briefingSummary: 'No Discovery interviews have been completed.',
    })).toBe(false);
  });

  it('returns true when participantCount > 0', () => {
    expect(hasDiscoveryData({
      discoveryThemes: [],
      painPoints: [],
      aspirations: [],
      participantCount: 3,
    })).toBe(true);
  });

  it('returns true when themes exist', () => {
    expect(hasDiscoveryData({
      discoveryThemes: [{ title: 'Digital Transformation', domain: 'Technology', frequency: 5, sentiment: 'mixed' }],
      painPoints: [],
      aspirations: [],
      participantCount: 0,
    })).toBe(true);
  });

  it('returns true when painPoints exist', () => {
    expect(hasDiscoveryData({
      discoveryThemes: [],
      painPoints: [{ description: 'Legacy systems', domain: 'Technology', frequency: 3, severity: 'significant' }],
      aspirations: [],
      participantCount: 0,
    })).toBe(true);
  });

  it('returns true when aspirations exist', () => {
    expect(hasDiscoveryData({
      discoveryThemes: [],
      painPoints: [],
      aspirations: ['Cloud-first architecture'],
      participantCount: 0,
    })).toBe(true);
  });

  it('handles untyped Record with no arrays (missing fields)', () => {
    expect(hasDiscoveryData({ briefingSummary: 'something' })).toBe(false);
  });

  it('returns true for full populated intelligence', () => {
    expect(hasDiscoveryData({
      maturitySnapshot: [{ domain: 'People', todayMedian: 2, targetMedian: 4, projectedMedian: 3, spread: 1.2, narrative: 'Mixed' }],
      discoveryThemes: [{ title: 'Talent Retention', domain: 'People', frequency: 8, sentiment: 'negative', keyQuotes: ['High turnover'] }],
      consensusAreas: ['Need for better tools'],
      divergenceAreas: [{ topic: 'AI adoption', perspectives: ['For', 'Against'] }],
      painPoints: [{ description: 'Manual processes', domain: 'Organisation', frequency: 6, severity: 'critical' }],
      aspirations: ['Automated workflows', 'Better customer experience'],
      watchPoints: ['Morale sensitivity'],
      participantCount: 12,
      synthesizedAtMs: Date.now(),
      briefingSummary: 'Twelve participants completed interviews...',
    })).toBe(true);
  });
});

// ================================================================
// 2. Zero-discovery forbidden phrase assertions
// ================================================================

describe('zero-discovery message content', () => {
  const FORBIDDEN_PHRASES_ZERO_DISCOVERY = [
    'Participants have completed their Discovery interviews',
    'This intelligence will seed the live workshop agents',
    'Discovery interviews are done',
    'Discovery interviews have ALREADY been completed',
    '0 themes, 0 pain points, 0 aspirations identified',
  ];

  /**
   * Mirror the acknowledgement logic from discovery-briefing/route.ts
   */
  function buildBriefingAcknowledgement(intelligence: Record<string, unknown>): string {
    const discoveryPresent = hasDiscoveryData(intelligence);
    const themes = Array.isArray(intelligence.discoveryThemes) ? intelligence.discoveryThemes : [];
    const painPoints = Array.isArray(intelligence.painPoints) ? intelligence.painPoints : [];
    const aspirations = Array.isArray(intelligence.aspirations) ? intelligence.aspirations : [];
    const count = typeof intelligence.participantCount === 'number' ? intelligence.participantCount : 0;

    return discoveryPresent
      ? `Thank you. The workshop briefing has been stored. ${themes.length} themes, ${painPoints.length} pain points, ${aspirations.length} aspirations identified from ${count} participants. This intelligence will seed the live workshop agents.`
      : `Understood. No completed Discovery interviews were found. The workshop will proceed without pre-interview intelligence. The briefing status has been recorded.`;
  }

  /**
   * Mirror the question handoff logic from questions/route.ts
   */
  function buildQuestionHandoff(discoveryBriefing: Record<string, unknown> | null): string {
    const discoveryAvailable = hasDiscoveryData(discoveryBriefing);
    return `Thank you, Research Agent. Now, Question Set Agent - using the research context${discoveryAvailable ? ' and Discovery interview insights' : ''}, could you design a set of workshop facilitation questions for the client? ${discoveryAvailable ? 'Discovery interviews have been completed. Use those insights to inform your questions, but do not repeat Discovery questions.' : 'Discovery interviews have not been completed yet. Design questions based on research context alone.'} These questions are for the live workshop session.`;
  }

  it('zero-discovery briefing acknowledgement contains no forbidden phrases', () => {
    const msg = buildBriefingAcknowledgement({
      discoveryThemes: [],
      painPoints: [],
      aspirations: [],
      participantCount: 0,
      briefingSummary: 'No Discovery interviews have been completed.',
    });
    for (const phrase of FORBIDDEN_PHRASES_ZERO_DISCOVERY) {
      expect(msg).not.toContain(phrase);
    }
  });

  it('zero-discovery briefing acknowledgement states no interviews found', () => {
    const msg = buildBriefingAcknowledgement({
      discoveryThemes: [],
      painPoints: [],
      aspirations: [],
      participantCount: 0,
    });
    expect(msg).toContain('No completed Discovery interviews');
    expect(msg).toContain('without pre-interview intelligence');
  });

  it('non-zero discovery acknowledgement uses success language', () => {
    const msg = buildBriefingAcknowledgement({
      discoveryThemes: [{ title: 'Theme' }],
      painPoints: [{ description: 'Pain' }],
      aspirations: ['Aspiration'],
      participantCount: 5,
    });
    expect(msg).toContain('workshop briefing has been stored');
    expect(msg).toContain('This intelligence will seed the live workshop agents');
    expect(msg).toContain('from 5 participants');
  });

  it('zero-discovery question handoff contains no forbidden phrases', () => {
    const msg = buildQuestionHandoff(null);
    for (const phrase of FORBIDDEN_PHRASES_ZERO_DISCOVERY) {
      expect(msg).not.toContain(phrase);
    }
  });

  it('zero-discovery question handoff says research-only', () => {
    const msg = buildQuestionHandoff({
      discoveryThemes: [],
      painPoints: [],
      aspirations: [],
      participantCount: 0,
    });
    expect(msg).toContain('Design questions based on research context alone');
    expect(msg).not.toContain('and Discovery interview insights');
  });

  it('non-zero discovery question handoff references discovery insights', () => {
    const msg = buildQuestionHandoff({
      discoveryThemes: [{ title: 'Theme' }],
      painPoints: [],
      aspirations: [],
      participantCount: 4,
    });
    expect(msg).toContain('and Discovery interview insights');
    expect(msg).toContain('Discovery interviews have been completed');
  });
});

// ================================================================
// 3. Question-set empty briefing guard
// ================================================================

describe('question-set get_discovery_insights tool guard', () => {
  it('treats null briefing as unavailable', () => {
    expect(hasDiscoveryData(null)).toBe(false);
  });

  it('treats empty-array briefing (zero-interview fallback) as unavailable', () => {
    const briefing = {
      discoveryThemes: [],
      painPoints: [],
      aspirations: [],
      participantCount: 0,
      briefingSummary: 'No Discovery interviews have been completed.',
    };
    expect(hasDiscoveryData(briefing)).toBe(false);
  });

  it('treats populated briefing as available', () => {
    const briefing = {
      discoveryThemes: [
        { title: 'Digital Maturity', domain: 'Technology', frequency: 5, sentiment: 'mixed' },
      ],
      painPoints: [
        { description: 'Legacy systems block innovation', domain: 'Technology', frequency: 3, severity: 'significant' },
      ],
      aspirations: ['Cloud-first architecture'],
      participantCount: 8,
      briefingSummary: 'Eight participants completed interviews...',
    };
    expect(hasDiscoveryData(briefing)).toBe(true);
  });

  it('treats briefing with only aspirations as available', () => {
    const briefing = {
      discoveryThemes: [],
      painPoints: [],
      aspirations: ['Better customer experience'],
      participantCount: 0,
    };
    expect(hasDiscoveryData(briefing)).toBe(true);
  });
});
