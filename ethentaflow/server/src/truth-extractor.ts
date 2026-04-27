// TruthExtractor — extracts specific, evidence-based truth nodes from user utterances.
//
// A truth node must be:
//   - specific: contains numbers, names, or concrete events
//   - evidence-based: tied to what the participant actually said
//   - standalone: understandable without conversation context
//
// Uses gpt-4o-mini with response_format json_object.
// Skips utterances < 8 words.
// Only returns nodes where isSpecific=true OR hasEvidence=true.

import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import type { Lens, MaturityRating, TruthNode } from './types.js';
import { getLensFramework } from './framework.js';

const SYSTEM_PROMPT = `You extract truth nodes from business discovery conversations.

A truth node is a specific, standalone, evidence-based fact from what the participant said.

Rules for a valid truth node:
- statement: concise standalone fact, max 15 words, no pronouns without referents
- evidence: verbatim or near-verbatim quote from the participant, max 25 words
- isSpecific: true if contains numbers, named entities, specific timelines, or measurable outcomes
- hasEvidence: true if directly tied to something the participant said (not inferred or assumed)

Only extract nodes that are genuinely informative. Skip vague generalities.
Never invent details not present in the utterance.

Return JSON: { "nodes": [ { "statement": "...", "evidence": "...", "isSpecific": bool, "hasEvidence": bool } ] }
Return an empty nodes array if nothing specific can be extracted.`;

interface RawTruthNode {
  statement: string;
  evidence: string;
  isSpecific: boolean;
  hasEvidence: boolean;
}

export class TruthExtractor {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async extract(
    lens: Lens,
    utterance: string,
    lastProbe: string | null,
    turnId: string,
    maturityRating?: MaturityRating,
  ): Promise<TruthNode[]> {
    // Skip very short utterances — no substance to extract
    const words = utterance.trim().split(/\s+/);
    if (words.length < 8) {
      console.log(`[truth] skipping — too short (${words.length} words)`);
      return [];
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    try {
      const userMessage = buildUserMessage(lens, utterance, lastProbe, maturityRating);

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }, { signal: controller.signal });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { nodes?: RawTruthNode[] };

      const rawNodes: RawTruthNode[] = Array.isArray(parsed.nodes) ? parsed.nodes : [];

      // Filter: only keep nodes where isSpecific OR hasEvidence
      const filtered = rawNodes.filter(n =>
        typeof n.statement === 'string' &&
        n.statement.trim().length > 0 &&
        typeof n.evidence === 'string' &&
        n.evidence.trim().length > 0 &&
        (n.isSpecific === true || n.hasEvidence === true)
      );

      const nodes: TruthNode[] = filtered.map(n => ({
        nodeId: randomUUID(),
        lensId: lens,
        statement: n.statement.trim().slice(0, 120),
        evidence: n.evidence.trim().slice(0, 200),
        isSpecific: Boolean(n.isSpecific),
        hasEvidence: Boolean(n.hasEvidence),
        extractedAt: Date.now(),
        sourceTurnId: turnId,
      }));

      console.log(`[truth] ${lens}: extracted ${nodes.length} node(s) from turn ${turnId}`);
      return nodes;
    } catch (err) {
      console.error(`[truth] extraction failed for turn ${turnId}`, err);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildUserMessage(
  lens: Lens,
  utterance: string,
  lastProbe: string | null,
  maturityRating?: MaturityRating,
): string {
  const lines: string[] = [
    `Lens: ${lens}`,
  ];

  const lensCtx = getLensFramework(lens);
  if (lensCtx) {
    lines.push('');
    lines.push('Evidence targets for this lens (what a strong, extractable fact looks like):');
    for (const t of lensCtx.evidenceTargets) {
      lines.push(`- ${t}`);
    }
    lines.push('');
    lines.push('Only extract nodes that match these targets. Reject vague statements that match these failure patterns:');
    for (const s of lensCtx.failureSignals) {
      lines.push(`- ${s}`);
    }
  }

  if (maturityRating) {
    lines.push('');
    lines.push(`Maturity context: current=${maturityRating.current}/5, target=${maturityRating.target}/5, trajectory=${maturityRating.trajectory}`);
  }

  if (lastProbe) {
    lines.push(`Question that prompted this response: "${lastProbe}"`);
  }

  lines.push('', `Participant utterance:`, `"${utterance}"`, '', 'Extract truth nodes.');

  return lines.join('\n');
}
