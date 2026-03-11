/**
 * AI-driven participant layer classification
 *
 * Classifies workshop participants into Executive / Operational / Frontline
 * layers using GPT-4o-mini. Supports facilitator overrides.
 */

import OpenAI from 'openai';
import type { NarrativeLayer, ParticipantLayerAssignment } from '@/lib/types/discover-analysis';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ParticipantInput = {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
};

export type ParticipantLayerMap = Record<
  string,
  { layer: NarrativeLayer; confidence: number; aiReason: string }
>;

/**
 * Keyword-based fallback when GPT is unavailable
 */
function heuristicClassify(role: string | null, department: string | null): NarrativeLayer {
  const text = `${role ?? ''} ${department ?? ''}`.toLowerCase();

  const executivePatterns = [
    'director', 'vp', 'vice president', 'head of', 'chief', 'c-suite',
    'ceo', 'cfo', 'cto', 'coo', 'cio', 'cmo', 'partner', 'executive',
    'president', 'board', 'founder', 'owner', 'managing',
  ];

  const operationalPatterns = [
    'manager', 'lead', 'coordinator', 'analyst', 'supervisor',
    'specialist', 'architect', 'engineer', 'consultant', 'planner',
    'strategist', 'advisor', 'senior',
  ];

  if (executivePatterns.some((p) => text.includes(p))) return 'executive';
  if (operationalPatterns.some((p) => text.includes(p))) return 'operational';
  return 'frontline';
}

/**
 * Classify participants into narrative layers using GPT-4o-mini.
 *
 * @param participants - Array of participant data
 * @param overrides - Optional facilitator overrides (participantId → layer)
 * @returns Full layer assignments with AI reasoning
 */
export async function classifyParticipantLayers(
  participants: ParticipantInput[],
  overrides?: Record<string, NarrativeLayer>,
): Promise<ParticipantLayerAssignment[]> {
  // If no participants, return empty
  if (participants.length === 0) return [];

  // Build AI classifications (for those not overridden)
  const aiMap: ParticipantLayerMap = {};

  if (process.env.OPENAI_API_KEY) {
    try {
      const participantList = participants.map((p) => ({
        id: p.id,
        role: p.role || 'Unknown',
        department: p.department || 'Unknown',
      }));

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You classify organisational roles into three narrative layers for stakeholder analysis.

LAYERS:
- "executive": Strategic decision-makers. Directors, VPs, C-suite, heads of departments, partners, board members, founders, owners. People who set direction and approve budgets.
- "operational": Middle management and specialists. Managers, team leads, analysts, architects, coordinators, supervisors, consultants. People who plan, design, and oversee execution.
- "frontline": Those closest to day-to-day delivery. Agents, representatives, associates, officers, clerks, operators, technicians, practitioners. People who execute processes and interact with customers directly.

When uncertain, consider:
- The scope of decision-making authority implied by the role
- Whether the role is strategic (executive), tactical (operational), or execution-focused (frontline)

Return ONLY valid JSON: an array of objects with { id, layer, confidence, reason }.
- confidence: 0-1 (how certain you are)
- reason: 1 sentence explaining why`,
          },
          {
            role: 'user',
            content: `Classify these participants:\n\n${JSON.stringify(participantList, null, 2)}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw) as {
        classifications?: Array<{
          id: string;
          layer: string;
          confidence: number;
          reason: string;
        }>;
      };

      const classifications = parsed.classifications || (Array.isArray(parsed) ? parsed : []);

      for (const c of classifications as Array<{ id: string; layer: string; confidence: number; reason: string }>) {
        const validLayer = ['executive', 'operational', 'frontline'].includes(c.layer)
          ? (c.layer as NarrativeLayer)
          : 'frontline';
        aiMap[c.id] = {
          layer: validLayer,
          confidence: typeof c.confidence === 'number' ? c.confidence : 0.7,
          aiReason: c.reason || 'Classified by AI',
        };
      }
    } catch (error) {
      console.error('AI layer classification failed, using heuristic fallback:', error);
      // Fall through to heuristic below
    }
  }

  // Build final assignments
  return participants.map((p) => {
    // Check for facilitator override first
    if (overrides?.[p.id]) {
      return {
        participantId: p.id,
        name: p.name,
        role: p.role,
        department: p.department,
        layer: overrides[p.id],
        confidence: 1.0,
        aiReason: 'Manually assigned by facilitator',
        isOverridden: true,
      };
    }

    // Use AI classification if available
    const ai = aiMap[p.id];
    if (ai) {
      return {
        participantId: p.id,
        name: p.name,
        role: p.role,
        department: p.department,
        layer: ai.layer,
        confidence: ai.confidence,
        aiReason: ai.aiReason,
        isOverridden: false,
      };
    }

    // Heuristic fallback
    const layer = heuristicClassify(p.role, p.department);
    return {
      participantId: p.id,
      name: p.name,
      role: p.role,
      department: p.department,
      layer,
      confidence: 0.5,
      aiReason: 'Classified by keyword heuristic (AI unavailable)',
      isOverridden: false,
    };
  });
}
