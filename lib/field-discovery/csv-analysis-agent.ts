/**
 * CSV Analysis Agent
 *
 * GPT-4o agent that reads any structured CSV file, understands what it
 * represents, and extracts diagnostic findings into the DREAM framework
 * (lens + type + title + description + evidence).
 *
 * Rather than sending raw rows (token-expensive), we pre-process the CSV
 * server-side into a compact analytical summary, then let GPT-4o act as
 * an organisational diagnostician over that summary.
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { FindingType, SourceStream } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsvImportResult {
  workshopId: string;
  fileName: string;
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

interface AgentFinding {
  lens: string;
  type: string;
  title: string;
  description: string;
  severity_score: number;
  confidence_score: number;
  data_evidence: string;
}

// ---------------------------------------------------------------------------
// CSV Parser (handles quoted fields)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Statistical pre-processing
// ---------------------------------------------------------------------------

/** Detect which columns contain mostly numeric data */
function detectNumericColumns(rows: Record<string, string>[], headers: string[]): string[] {
  return headers.filter((h) => {
    const sample = rows.slice(0, 50).map((r) => r[h]).filter(Boolean);
    const numericCount = sample.filter((v) => !isNaN(parseFloat(v)) && v !== '').length;
    return numericCount / Math.max(sample.length, 1) > 0.8;
  });
}

/** Detect a likely grouping column (low cardinality, non-numeric string) */
function detectGroupColumn(
  rows: Record<string, string>[],
  headers: string[],
  numericCols: Set<string>,
): string | null {
  const candidates = headers.filter((h) => {
    if (numericCols.has(h)) return false;
    const uniqueVals = new Set(rows.map((r) => r[h]).filter(Boolean));
    return uniqueVals.size >= 2 && uniqueVals.size <= 20;
  });

  // Prefer columns with names suggestive of groupings
  const preferred = candidates.find((h) =>
    /centre|center|team|department|group|region|site|location|division|unit/i.test(h),
  );
  return preferred ?? candidates[0] ?? null;
}

/** Compute per-group averages for numeric columns */
function computeGroupAverages(
  rows: Record<string, string>[],
  groupCol: string,
  numericCols: string[],
): Record<string, Record<string, number>> {
  const buckets: Record<string, Record<string, number[]>> = {};

  for (const row of rows) {
    const group = row[groupCol] || 'Unknown';
    if (!buckets[group]) buckets[group] = {};
    for (const col of numericCols) {
      const val = parseFloat(row[col]);
      if (!isNaN(val)) {
        if (!buckets[group][col]) buckets[group][col] = [];
        buckets[group][col].push(val);
      }
    }
  }

  const result: Record<string, Record<string, number>> = {};
  for (const [group, cols] of Object.entries(buckets)) {
    result[group] = {};
    for (const [col, vals] of Object.entries(cols)) {
      result[group][col] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
  }
  return result;
}

/** Compute overall column stats (min, max, mean) */
function computeOverallStats(
  rows: Record<string, string>[],
  numericCols: string[],
): Record<string, { min: number; max: number; mean: number }> {
  const result: Record<string, { min: number; max: number; mean: number }> = {};
  for (const col of numericCols) {
    const vals = rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v));
    if (vals.length === 0) continue;
    result[col] = {
      min: Math.round(Math.min(...vals) * 10) / 10,
      max: Math.round(Math.max(...vals) * 10) / 10,
      mean: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
    };
  }
  return result;
}

/**
 * Build a compact analytical summary to send to the agent instead of raw rows.
 * This keeps token usage manageable even for 1000-row files.
 */
function buildAnalysisSummary(
  headers: string[],
  rows: Record<string, string>[],
  fileName: string,
  userContext: string,
): string {
  const numericCols = detectNumericColumns(rows, headers);
  const numericSet = new Set(numericCols);
  const groupCol = detectGroupColumn(rows, headers, numericSet);

  const parts: string[] = [];

  parts.push(`FILE: ${fileName}`);
  parts.push(`TOTAL ROWS: ${rows.length}`);
  if (userContext) parts.push(`CONTEXT PROVIDED: ${userContext}`);

  parts.push(`\nCOLUMNS (${headers.length} total):`);
  const stringCols = headers.filter((h) => !numericSet.has(h));
  if (stringCols.length) parts.push(`  Categorical: ${stringCols.join(', ')}`);
  if (numericCols.length) parts.push(`  Numeric: ${numericCols.join(', ')}`);

  // Sample categorical column values (for context)
  const catSample = stringCols.slice(0, 6).map((col) => {
    const uniqueVals = [...new Set(rows.map((r) => r[col]).filter(Boolean))].slice(0, 8);
    return `  ${col}: ${uniqueVals.join(' | ')}`;
  });
  if (catSample.length) {
    parts.push('\nCATEGORICAL VALUES (sample):');
    parts.push(catSample.join('\n'));
  }

  // Overall numeric stats
  const overallStats = computeOverallStats(rows, numericCols);
  if (Object.keys(overallStats).length) {
    parts.push('\nOVERALL NUMERIC STATS (min / mean / max):');
    for (const [col, s] of Object.entries(overallStats)) {
      parts.push(`  ${col}: ${s.min} / ${s.mean} / ${s.max}`);
    }
  }

  // Per-group averages
  if (groupCol) {
    const groupAvgs = computeGroupAverages(rows, groupCol, numericCols);
    const groups = Object.keys(groupAvgs);
    parts.push(`\nPER-GROUP AVERAGES (grouped by "${groupCol}"):`);

    // Build table: metric | group1 | group2 | ...
    const colsToShow = numericCols.slice(0, 30); // cap columns to avoid huge tables
    const header = `Metric | ${groups.join(' | ')}`;
    parts.push(header);
    for (const col of colsToShow) {
      const row = `${col} | ${groups.map((g) => groupAvgs[g]?.[col] ?? 'N/A').join(' | ')}`;
      parts.push(row);
    }

    // Highlight best/worst per metric
    parts.push('\nBEST vs WORST GROUP PER KEY METRIC:');
    for (const col of colsToShow) {
      const ranked = groups
        .map((g) => ({ group: g, val: groupAvgs[g]?.[col] }))
        .filter((x) => x.val !== undefined)
        .sort((a, b) => (b.val! - a.val!));
      if (ranked.length >= 2) {
        parts.push(
          `  ${col}: Best=${ranked[0].group} (${ranked[0].val}) | Worst=${ranked[ranked.length - 1].group} (${ranked[ranked.length - 1].val})`,
        );
      }
    }
  }

  // 5 sample rows
  parts.push('\nSAMPLE ROWS (first 5):');
  rows.slice(0, 5).forEach((row, i) => {
    const vals = headers.map((h) => `${h}=${row[h]}`).join(', ');
    parts.push(`  Row ${i + 1}: ${vals}`);
  });

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const MODEL = 'gpt-4o';
const MAX_ITERATIONS = 4;

function buildSystemPrompt(lensNames: string[]): string {
  return `You are an organisational discovery analyst for DREAM diagnostic workshops.

You have been given a statistical summary of a structured data file. Your job is to:
1. Understand what this data represents — what organisation, people, systems, or processes it describes
2. Identify meaningful patterns, outliers, trends, and systemic issues
3. Extract these as structured diagnostic findings using the DREAM framework

Each finding must be classified as:
- **lens**: One of ${lensNames.join(', ')}

- **type**: One of constraint, opportunity, risk, contradiction
  - constraint: a barrier, blocker, or limitation holding the org back
  - opportunity: an improvement, quick win, or untapped potential
  - risk: a threat, vulnerability, or early warning signal
  - contradiction: conflicting signals, a gap between perception and reality, or inconsistent patterns

- **title**: A punchy, specific title under 10 words
- **description**: 2-3 sentences. Be an organisational diagnostician — explain what the pattern REVEALS about the org's health, culture, or strategy. Don't just report the number; tell the story behind it.
- **severity_score**: 1–10 (10 = urgent, critical business impact)
- **confidence_score**: 0–1 (how strongly the data supports this finding)
- **data_evidence**: The specific number, pattern, or comparison that grounds this finding

Guidelines:
- Extract 8–15 meaningful findings
- Look for performance gaps between groups/teams/sites — these reveal structural or cultural divides
- Look for human signals hidden in operational metrics (e.g. absence = disengagement)
- Spot where customer impact is caused by internal failures
- Identify contradictions — where the data tells a different story from what management would expect
- Be specific: name the groups, quote the numbers, show the gap
- Avoid generic observations — every finding must be grounded in the data summary provided`;
}

function buildTools(lensNames: string[]): OpenAI.ChatCompletionTool[] {
  return [
  {
    type: 'function',
    function: {
      name: 'submit_findings',
      description: 'Submit the diagnostic findings extracted from the data analysis',
      parameters: {
        type: 'object',
        properties: {
          data_interpretation: {
            type: 'string',
            description: 'Brief (2-3 sentence) interpretation of what this dataset represents and its organisational context',
          },
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
                data_evidence: { type: 'string' },
              },
              required: [
                'lens', 'type', 'title', 'description',
                'severity_score', 'confidence_score', 'data_evidence',
              ],
            },
          },
        },
        required: ['data_interpretation', 'findings'],
      },
    },
  },
  ];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyse a CSV file and persist findings as STREAM_B discoveries.
 */
export async function analyseCsvAndExtractFindings(params: {
  workshopId: string;
  csvText: string;
  fileName: string;
  userContext?: string;
  lensNames?: string[];
}): Promise<CsvImportResult> {
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const { headers, rows } = parseCsv(params.csvText);
  if (rows.length === 0) {
    return { workshopId: params.workshopId, fileName: params.fileName, findingsCreated: 0, findings: [] };
  }

  const summary = buildAnalysisSummary(
    headers,
    rows,
    params.fileName,
    params.userContext ?? '',
  );

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(params.lensNames ?? []) },
    {
      role: 'user',
      content: `Please analyse the following data summary and extract diagnostic findings using the submit_findings tool.\n\n---\n\n${summary}\n\n---`,
    },
  ];

  let extractedFindings: AgentFinding[] = [];
  let dataInterpretation = '';

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
        if (toolCall.function?.name === 'submit_findings') {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            extractedFindings = parsed.findings ?? [];
            dataInterpretation = parsed.data_interpretation ?? '';
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

  // Map to Prisma enums and persist
  const FINDING_TYPE_MAP: Record<string, FindingType> = {
    constraint: 'CONSTRAINT',
    opportunity: 'OPPORTUNITY',
    risk: 'RISK',
    contradiction: 'CONTRADICTION',
  };

  const createdFindings = [];

  for (const f of extractedFindings) {
    const findingType = FINDING_TYPE_MAP[f.type?.toLowerCase()];
    if (!findingType) continue;

    const finding = await prisma.finding.create({
      data: {
        workshopId: params.workshopId,
        captureSessionId: null,
        sourceStream: 'STREAM_B' as SourceStream,
        lens: f.lens,
        type: findingType,
        title: f.title,
        description: f.description,
        severityScore: f.severity_score ?? null,
        frequencyCount: 1,
        roleCoverage: [],
        supportingQuotes: [
          {
            text: f.data_evidence,
            source: params.fileName,
          },
        ] as any,
        confidenceScore: f.confidence_score ?? null,
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

  return {
    workshopId: params.workshopId,
    fileName: params.fileName,
    findingsCreated: createdFindings.length,
    findings: createdFindings,
  };
}
