import OpenAI from 'openai';

import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import {
  clamp01,
  safeDomain,
  safeLabel,
  safeOrientation,
  safePressureType,
  type ReimagineDomain,
  type ReimagineEnrichment,
  type ReimagineLabel,
  type ReimaginePressureEdge,
} from '@/lib/reimagine/types';

function safeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function safeNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function stableModelVersion(): string {
  return 'reimagine-v1';
}

function buildPrompt(params: { text: string; dialoguePhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null }) {
  const phase = params.dialoguePhase || 'REIMAGINE';
  return `You are an organisational sense-making engine for a live DREAM workshop.

You must convert imperfect speech fragments into structured intent signals.

Rules:
- Never invent facts. Only use what is present in the text.
- Never suggest solutions, initiatives, tools, vendors, products, or technologies.
- Do not name vendors/brands.
- Output must be strict JSON.

Task:
Given the utterance text, produce:
1) intentSentence: a clean single sentence capturing what the speaker meant.
2) labels: multi-label classification with confidence (0-1): Aspiration, Dream, Constraint, Friction, Idea, Assumption.
3) domains: multi-domain mapping with confidence (0-1): People, Organisation, Customer, Technology, Regulation.
4) orientation: one of Current, Future, Transition, Enabling_requirement with confidence (0-1).
5) pressureEdges: zero or more cross-domain edges where one domain depends on / constrains / blocks another.
   Each edge must include fromDomain, toDomain, pressureType (DEPENDS_ON|CONSTRAINS|BLOCKS), confidence (0-1), and evidence (a short clause from the utterance).

Dialogue phase context: ${JSON.stringify(phase)}

Return JSON with keys exactly:
- intentSentence (string)
- labels (array of {label, confidence})
- domains (array of {domain, confidence})
- orientation ({value, confidence})
- pressureEdges (array of {fromDomain,toDomain,pressureType,confidence,evidence})

Utterance:
${JSON.stringify(params.text)}`;
}

function parseEnrichment(raw: string): ReimagineEnrichment | null {
  let obj: unknown = {};
  try {
    obj = JSON.parse(raw) as unknown;
  } catch {
    obj = {};
  }
  const rec: Record<string, unknown> = obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};

  const intentSentence = safeString(rec.intentSentence);

  const labelsRaw = Array.isArray(rec.labels) ? rec.labels : [];
  const labels = labelsRaw
    .map((x) => {
      const r: Record<string, unknown> = x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
      const label = safeLabel(r.label);
      const confidence = clamp01(safeNumber(r.confidence));
      return label ? { label, confidence } : null;
    })
    .filter(Boolean) as Array<{ label: ReimagineLabel; confidence: number }>;

  const domainsRaw = Array.isArray(rec.domains) ? rec.domains : [];
  const domains = domainsRaw
    .map((x) => {
      const r: Record<string, unknown> = x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
      const domain = safeDomain(r.domain);
      const confidence = clamp01(safeNumber(r.confidence));
      return domain ? { domain, confidence } : null;
    })
    .filter(Boolean) as Array<{ domain: ReimagineDomain; confidence: number }>;

  const orientationRec: Record<string, unknown> =
    rec.orientation && typeof rec.orientation === 'object' && !Array.isArray(rec.orientation)
      ? (rec.orientation as Record<string, unknown>)
      : {};
  const orientationValue = safeOrientation(orientationRec.value);
  const orientationConfidence = clamp01(safeNumber(orientationRec.confidence));

  const pressureRaw = Array.isArray(rec.pressureEdges) ? rec.pressureEdges : [];
  const pressureEdges = pressureRaw
    .map((x) => {
      const r: Record<string, unknown> = x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
      const fromDomain = safeDomain(r.fromDomain);
      const toDomain = safeDomain(r.toDomain);
      const pressureType = safePressureType(r.pressureType);
      const confidence = clamp01(safeNumber(r.confidence));
      const evidence = safeString(r.evidence);
      if (!fromDomain || !toDomain || !pressureType) return null;
      const edge: ReimaginePressureEdge = { fromDomain, toDomain, pressureType, confidence, evidence };
      return edge;
    })
    .filter(Boolean) as ReimaginePressureEdge[];

  if (!intentSentence) return null;
  if (!orientationValue) return null;

  return {
    intentSentence,
    labels,
    domains,
    orientation: { value: orientationValue, confidence: orientationConfidence },
    pressureEdges,
  };
}

export async function ensureReimagineSignal(params: {
  workshopId: string;
  dataPointId: string;
  rawText: string;
  dialoguePhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null;
}): Promise<void> {
  const cleaned = (params.rawText || '').trim();
  if (!cleaned) return;

  const existing = await prisma.reimagineSignal.findUnique({
    where: { dataPointId: params.dataPointId },
    select: { id: true },
  });
  if (existing) return;

  if (!env.OPENAI_API_KEY) return;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const prompt = buildPrompt({ text: cleaned, dialoguePhase: params.dialoguePhase });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  const enrichment = parseEnrichment(raw);
  if (!enrichment) return;

  const labelConfidences: Record<string, number> = {};
  for (const l of enrichment.labels) labelConfidences[l.label] = l.confidence;

  const domainConfidences: Record<string, number> = {};
  for (const d of enrichment.domains) domainConfidences[d.domain] = d.confidence;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const signal = await tx.reimagineSignal.create({
      data: {
        workshopId: params.workshopId,
        dataPointId: params.dataPointId,
        intentSentence: enrichment.intentSentence,
        labels: enrichment.labels.map((x) => x.label),
        labelConfidences,
        domains: enrichment.domains.map((x) => x.domain),
        domainConfidences,
        orientation: enrichment.orientation.value,
        orientationConfidence: enrichment.orientation.confidence,
        pressureEdges: enrichment.pressureEdges,
        modelVersion: stableModelVersion(),
      },
      select: { id: true },
    });

    for (const e of enrichment.pressureEdges) {
      const where = {
        workshopId_fromDomain_toDomain_pressureType: {
          workshopId: params.workshopId,
          fromDomain: e.fromDomain,
          toDomain: e.toDomain,
          pressureType: e.pressureType,
        },
      } as const;

      const current = await tx.reimaginePressureEdge.findUnique({
        where,
        select: { id: true, evidenceSignalIds: true, supportCount: true },
      });

      if (!current) {
        await tx.reimaginePressureEdge.create({
          data: {
            workshopId: params.workshopId,
            fromDomain: e.fromDomain,
            toDomain: e.toDomain,
            pressureType: e.pressureType,
            supportCount: 1,
            evidenceSignalIds: [signal.id],
            firstSeenAt: now,
            lastSeenAt: now,
          },
        });
        continue;
      }

      const nextEvidence = [...(current.evidenceSignalIds || [])];
      if (!nextEvidence.includes(signal.id)) nextEvidence.push(signal.id);
      const trimmed = nextEvidence.slice(Math.max(0, nextEvidence.length - 50));

      await tx.reimaginePressureEdge.update({
        where,
        data: {
          supportCount: current.supportCount + 1,
          lastSeenAt: now,
          evidenceSignalIds: trimmed,
        },
      });
    }
  });
}
