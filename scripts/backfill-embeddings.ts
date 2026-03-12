/**
 * scripts/backfill-embeddings.ts
 *
 * Backfills embedding vectors for all existing content in the knowledge base.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts
 *   npx tsx scripts/backfill-embeddings.ts --dry-run
 *   npx tsx scripts/backfill-embeddings.ts --source=discovery_themes
 *
 * Design:
 *   - Cursor-based pagination (fully resumable — safe to restart)
 *   - BATCH=20, SLEEP=300ms — avoids OpenAI rate limits
 *   - Never touches seed data — only writes to the `embedding` column
 *
 * Process order (smallest/fastest tables first):
 *   discovery_themes → conversation_insights → data_points →
 *   workshop_scratchpads → conversation_messages → transcript_chunks
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

// Load env
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH = 20;
const SLEEP_MS = 300;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_CHARS = 32_000;

const isDryRun = process.argv.includes('--dry-run');
const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];

type SourceName =
  | 'discovery_themes'
  | 'conversation_insights'
  | 'data_points'
  | 'workshop_scratchpads'
  | 'conversation_messages'
  | 'transcript_chunks';

const ALL_SOURCES: SourceName[] = [
  'discovery_themes',
  'conversation_insights',
  'data_points',
  'workshop_scratchpads',
  'conversation_messages',
  'transcript_chunks',
];

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embed(text: string): Promise<number[]> {
  const input = text.slice(0, MAX_CHARS);
  const resp = await openai.embeddings.create({ model: EMBEDDING_MODEL, input });
  const vector = resp.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) throw new Error('Empty embedding response');
  return vector;
}

async function store(table: SourceName, id: string, vector: number[]): Promise<void> {
  const literal = `[${vector.join(',')}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET embedding = $1::vector WHERE id = $2`,
    literal,
    id
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Text extractors ──────────────────────────────────────────────────────────

function extractJsonText(obj: unknown): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(extractJsonText).filter(Boolean).join(' ');
  if (typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>)
      .map(extractJsonText)
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

// ─── Per-source backfill ──────────────────────────────────────────────────────

type RawRow = { id: string; text: string };

async function backfillSource(source: SourceName): Promise<void> {
  console.log(`\n▶ ${source}`);
  let cursor = '';
  let total = 0;
  let errors = 0;

  while (true) {
    let rows: RawRow[] = [];

    if (source === 'discovery_themes') {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT id,
               COALESCE(theme_label || ': ' || theme_description, theme_label) AS text
        FROM   discovery_themes
        WHERE  embedding IS NULL
          AND  id > ${cursor}
        ORDER  BY id
        LIMIT  ${BATCH}
      `;
    } else if (source === 'conversation_insights') {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT id, text
        FROM   conversation_insights
        WHERE  embedding IS NULL
          AND  id > ${cursor}
        ORDER  BY id
        LIMIT  ${BATCH}
      `;
    } else if (source === 'data_points') {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT id, raw_text AS text
        FROM   data_points
        WHERE  embedding IS NULL
          AND  id > ${cursor}
        ORDER  BY id
        LIMIT  ${BATCH}
      `;
    } else if (source === 'workshop_scratchpads') {
      // Fetch JSON blobs and extract text in JS
      const scratchpadRows = await prisma.$queryRaw<Array<{
        id: string;
        exec_summary: unknown;
        discovery_output: unknown;
        reimagine_content: unknown;
        constraints_content: unknown;
        potential_solution: unknown;
        summary_content: unknown;
      }>>`
        SELECT id,
               exec_summary,
               discovery_output,
               reimagine_content,
               constraints_content,
               potential_solution,
               summary_content
        FROM   workshop_scratchpads
        WHERE  embedding IS NULL
          AND  id > ${cursor}
        ORDER  BY id
        LIMIT  ${BATCH}
      `;
      rows = scratchpadRows.map((r) => ({
        id: r.id,
        text: [
          extractJsonText(r.exec_summary),
          extractJsonText(r.discovery_output),
          extractJsonText(r.reimagine_content),
          extractJsonText(r.constraints_content),
          extractJsonText(r.potential_solution),
          extractJsonText(r.summary_content),
        ]
          .filter(Boolean)
          .join('\n'),
      })).filter((r) => r.text.length > 0);
    } else if (source === 'conversation_messages') {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT id, content AS text
        FROM   conversation_messages
        WHERE  embedding IS NULL
          AND  role = 'PARTICIPANT'
          AND  id > ${cursor}
        ORDER  BY id
        LIMIT  ${BATCH}
      `;
    } else if (source === 'transcript_chunks') {
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT id, text
        FROM   transcript_chunks
        WHERE  embedding IS NULL
          AND  LENGTH(text) >= 20
          AND  id > ${cursor}
        ORDER  BY id
        LIMIT  ${BATCH}
      `;
    }

    if (rows.length === 0) break;

    for (const row of rows) {
      const text = row.text?.trim();
      if (!text) {
        cursor = row.id;
        continue;
      }
      try {
        if (isDryRun) {
          console.log(`  [dry-run] ${row.id} — ${text.slice(0, 60)}…`);
        } else {
          const vector = await embed(text);
          await store(source, row.id, vector);
          process.stdout.write('.');
        }
        total++;
      } catch (err) {
        errors++;
        console.error(`\n  ✗ ${row.id}:`, err instanceof Error ? err.message : String(err));
      }
      cursor = row.id;
      await sleep(SLEEP_MS / BATCH);  // spread 300ms across the batch
    }

    await sleep(SLEEP_MS);
    if (!isDryRun) process.stdout.write(`\n  batch done (total: ${total})\n`);
  }

  console.log(`  ✓ ${source}: ${isDryRun ? 'would process' : 'embedded'} ${total} rows${errors > 0 ? `, ${errors} errors` : ''}`);
}

// ─── Count helpers (for dry-run) ──────────────────────────────────────────────

async function countPending(source: SourceName): Promise<number> {
  if (source === 'discovery_themes') {
    const r = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM discovery_themes WHERE embedding IS NULL
    `;
    return Number(r[0].count);
  }
  if (source === 'conversation_insights') {
    const r = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM conversation_insights WHERE embedding IS NULL
    `;
    return Number(r[0].count);
  }
  if (source === 'data_points') {
    const r = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM data_points WHERE embedding IS NULL
    `;
    return Number(r[0].count);
  }
  if (source === 'workshop_scratchpads') {
    const r = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM workshop_scratchpads WHERE embedding IS NULL
    `;
    return Number(r[0].count);
  }
  if (source === 'conversation_messages') {
    const r = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM conversation_messages WHERE embedding IS NULL AND role = 'PARTICIPANT'
    `;
    return Number(r[0].count);
  }
  if (source === 'transcript_chunks') {
    const r = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM transcript_chunks WHERE embedding IS NULL AND LENGTH(text) >= 20
    `;
    return Number(r[0].count);
  }
  return 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Backfill Embeddings ${isDryRun ? '(DRY RUN)' : ''} ===`);
  console.log(`Model: ${EMBEDDING_MODEL}, Batch: ${BATCH}, Sleep: ${SLEEP_MS}ms`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('✗ OPENAI_API_KEY not set');
    process.exit(1);
  }

  const sources = sourceArg
    ? ALL_SOURCES.filter((s) => s === sourceArg)
    : ALL_SOURCES;

  if (sources.length === 0) {
    console.error(`✗ Unknown source: ${sourceArg}. Valid: ${ALL_SOURCES.join(', ')}`);
    process.exit(1);
  }

  if (isDryRun) {
    console.log('\nPending counts:');
    for (const source of sources) {
      const count = await countPending(source);
      console.log(`  ${source}: ${count} rows`);
    }
    console.log('\nDry run complete — no changes made.');
  } else {
    for (const source of sources) {
      await backfillSource(source);
    }
    console.log('\n✓ Backfill complete.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
