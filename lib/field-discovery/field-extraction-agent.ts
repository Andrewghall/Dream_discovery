/**
 * Field Extraction Agent
 *
 * GPT-4o-mini tool-calling agent that processes capture session transcripts
 * into structured Findings. Follows the same tool-calling pattern as
 * lib/cognition/agents/facilitation-agent.ts.
 *
 * Called after transcription completes on a capture session.
 * Creates Finding records with source_stream = STREAM_B.
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { FindingType, SourceStream } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  sessionId: string;
  findingsCreated: number;
  findings: Array<{
    lens: string;
    type: FindingType;
    title: string;
    description: string;
    severityScore: number;
    confidenceScore: number;
  }>;
}

interface ExtractedFinding {
  lens: string;
  type: string;
  title: string;
  description: string;
  severity_score: number;
  confidence_score: number;
  supporting_quote: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'gpt-4o-mini';
const MAX_ITERATIONS = 4;

function buildSystemPrompt(lensNames: string[]): string {
  return `You are a field discovery analyst for DREAM diagnostic workshops.

You are given the transcript of a field capture session (interview or walkaround observation).
Your job is to extract structured findings from the transcript.

Each finding must be classified by:
- **lens**: One of ${lensNames.join(', ')}
- **type**: One of constraint, opportunity, risk, contradiction
- **title**: A concise title (under 10 words)
- **description**: 2-3 sentence description of the finding with context
- **severity_score**: 1-10 scale (10 = critical business impact)
- **confidence_score**: 0-1 scale (how confident you are in the classification)
- **supporting_quote**: The most relevant direct quote from the transcript

Guidelines:
- Extract ALL relevant findings, typically 3-8 per session
- Look for constraints (barriers, blockers, limitations)
- Look for opportunities (improvements, quick wins, innovations)
- Look for risks (threats, vulnerabilities, concerns)
- Look for contradictions (conflicting statements, perception gaps)
- Be specific and evidence-based
- Use the speaker's own words where possible
- Do NOT invent findings that are not supported by the transcript`;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

function buildTools(lensNames: string[]): OpenAI.ChatCompletionTool[] {
  return [
  {
    type: 'function',
    function: {
      name: 'submit_findings',
      description: 'Submit the extracted findings from the transcript analysis',
      parameters: {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                lens: {
                  type: 'string',
                  enum: lensNames,
                },
                type: {
                  type: 'string',
                  enum: ['constraint', 'opportunity', 'risk', 'contradiction'],
                },
                title: { type: 'string' },
                description: { type: 'string' },
                severity_score: { type: 'number', minimum: 1, maximum: 10 },
                confidence_score: { type: 'number', minimum: 0, maximum: 1 },
                supporting_quote: { type: 'string' },
              },
              required: ['lens', 'type', 'title', 'description', 'severity_score', 'confidence_score', 'supporting_quote'],
            },
          },
        },
        required: ['findings'],
      },
    },
  },
  ];
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Extract findings from a capture session's transcript segments.
 */
export async function extractFindings(params: {
  sessionId: string;
  workshopId: string;
  captureType: string;
  actorRole: string | null;
  area: string | null;
  lensNames?: string[];
}): Promise<ExtractionResult> {
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Gather all transcript segments for this session
  const segments = await prisma.captureSegment.findMany({
    where: { captureSessionId: params.sessionId },
    orderBy: { segmentIndex: 'asc' },
    select: { segmentIndex: true, transcript: true },
  });

  const fullTranscript = segments
    .filter((s) => s.transcript)
    .map((s) => `[Segment ${s.segmentIndex + 1}]\n${s.transcript}`)
    .join('\n\n');

  if (!fullTranscript.trim()) {
    return { sessionId: params.sessionId, findingsCreated: 0, findings: [] };
  }

  const contextHeader = [
    `Capture Type: ${params.captureType.replace(/_/g, ' ')}`,
    params.actorRole ? `Actor Role: ${params.actorRole}` : null,
    params.area ? `Area/Department: ${params.area}` : null,
  ].filter(Boolean).join('\n');

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(params.lensNames ?? []) },
    {
      role: 'user',
      content: `${contextHeader}\n\n---\n\nTRANSCRIPT:\n\n${fullTranscript}\n\n---\n\nPlease analyse this transcript and extract all relevant findings using the submit_findings tool.`,
    },
  ];

  // Tool-calling loop
  let extractedFindings: ExtractedFinding[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openAiBreaker.execute(() => openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: buildTools(params.lensNames ?? []),
      tool_choice: i === 0 ? { type: 'function', function: { name: 'submit_findings' } } : 'auto',
    }));

    const choice = response.choices[0];
    if (!choice?.message) break;

    messages.push(choice.message);

    if (choice.message.tool_calls?.length) {
      for (const toolCall of choice.message.tool_calls as any[]) {
        const fnName = toolCall.function?.name;
        if (fnName === 'submit_findings') {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            extractedFindings = parsed.findings || [];
          } catch {
            extractedFindings = [];
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: true, count: extractedFindings.length }),
          });
        }
      }
    }

    if (choice.finish_reason === 'stop' || extractedFindings.length > 0) break;
  }

  // Persist findings to database
  const FINDING_TYPE_MAP: Record<string, FindingType> = {
    constraint: 'CONSTRAINT',
    opportunity: 'OPPORTUNITY',
    risk: 'RISK',
    contradiction: 'CONTRADICTION',
  };

  const createdFindings = [];
  for (const f of extractedFindings) {
    const findingType = FINDING_TYPE_MAP[f.type.toLowerCase()];
    if (!findingType) continue;

    const finding = await prisma.finding.create({
      data: {
        workshopId: params.workshopId,
        captureSessionId: params.sessionId,
        sourceStream: 'STREAM_B' as SourceStream,
        lens: f.lens,
        type: findingType,
        title: f.title,
        description: f.description,
        severityScore: f.severity_score,
        frequencyCount: 1,
        roleCoverage: params.actorRole ? [params.actorRole] : [],
        supportingQuotes: [
          {
            text: f.supporting_quote,
            sessionId: params.sessionId,
          },
        ] as any,
        confidenceScore: f.confidence_score,
      },
    });

    createdFindings.push({
      lens: f.lens,
      type: findingType,
      title: f.title,
      description: f.description,
      severityScore: f.severity_score,
      confidenceScore: f.confidence_score,
    });
  }

  // Update session status to ANALYSED
  await prisma.captureSession.update({
    where: { id: params.sessionId },
    data: { status: 'ANALYSED' },
  });

  return {
    sessionId: params.sessionId,
    findingsCreated: createdFindings.length,
    findings: createdFindings,
  };
}
