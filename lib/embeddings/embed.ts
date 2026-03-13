/**
 * lib/embeddings/embed.ts
 *
 * Core embedding utilities.
 *
 * - generateEmbedding(text)    — calls text-embedding-3-small via openAiBreaker
 * - embedAndStore(table, id, text) — generates + writes to DB column
 * - embedAsync(table, id, text)   — fire-and-forget, never blocks caller
 *
 * SQL injection defence: table names are validated against ALLOWED_TABLES.
 * The vector value is pure numbers so safe to interpolate; id is parameterised.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import { prisma } from '@/lib/prisma';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const EMBEDDING_MODEL = 'text-embedding-3-small';
// 32,000 chars ≈ 8,000 tokens — safe ceiling for this model
const MAX_CHARS = 32_000;

export type EmbeddableTable =
  | 'conversation_insights'
  | 'conversation_messages'
  | 'discovery_themes'
  | 'transcript_chunks'
  | 'data_points'
  | 'workshop_scratchpads'
  | 'capture_segments'
  | 'document_chunks';

const ALLOWED_TABLES = new Set<EmbeddableTable>([
  'conversation_insights',
  'conversation_messages',
  'discovery_themes',
  'transcript_chunks',
  'data_points',
  'workshop_scratchpads',
  'capture_segments',
  'document_chunks',
]);

/**
 * Prepend cohort context to text before embedding so the vector carries
 * role signal. Used by backfill and live write paths.
 *
 * Safe for all attributionPreference values — role/department is not
 * personally identifying. Name is never included.
 *
 * Examples:
 *   buildEmbedText("Agents optimise for handle time", "Team Leader", "Operations")
 *   → "[Team Leader, Operations] Agents optimise for handle time"
 *
 *   buildEmbedText("No coaching infrastructure", null, null)
 *   → "No coaching infrastructure"  (no prefix if no role data)
 */
export function buildEmbedText(
  text: string,
  role?: string | null,
  department?: string | null
): string {
  const prefix = [role, department].filter(Boolean).join(', ');
  return prefix ? `[${prefix}] ${text}` : text;
}

/**
 * Generate a 1536-dimensional embedding vector for the given text.
 * Throws if OpenAI is unavailable or returns an unexpected response.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error('[embeddings] OPENAI_API_KEY not configured');
  }
  const input = text.slice(0, MAX_CHARS);
  const resp = await openAiBreaker.execute(() =>
    openai!.embeddings.create({ model: EMBEDDING_MODEL, input })
  );
  const vector = resp.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('[embeddings] Empty embedding returned from OpenAI');
  }
  return vector;
}

/**
 * Generate an embedding for `text` and write it to the `embedding` column
 * of `table` for the row with the given `id`.
 *
 * Safe: table validated against allowlist; vector is pure numbers; id is parameterised.
 */
export async function embedAndStore(
  table: EmbeddableTable,
  id: string,
  text: string
): Promise<void> {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`[embeddings] Table "${table}" is not in ALLOWED_TABLES`);
  }
  const vector = await generateEmbedding(text);
  // pgvector literal format: '[0.1,0.2,...]'
  const vectorLiteral = `[${vector.join(',')}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET embedding = $1::vector WHERE id = $2`,
    vectorLiteral,
    id
  );
}

/**
 * Fire-and-forget version of embedAndStore.
 * Never throws, never blocks the caller. Logs errors to console.
 */
export function embedAsync(
  table: EmbeddableTable,
  id: string,
  text: string
): void {
  embedAndStore(table, id, text).catch((err) => {
    console.error(`[embeddings] embedAsync failed for ${table}/${id}:`, err);
  });
}
