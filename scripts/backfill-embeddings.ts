/**
 * scripts/backfill-embeddings.ts
 *
 * Backfills embedding vectors for all existing content in the knowledge base.
 * Embeddings include cohort context (role + department) for participant-attributed
 * tables so the vector carries role signal at retrieval time.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts
 *   npx tsx scripts/backfill-embeddings.ts --dry-run
 *   npx tsx scripts/backfill-embeddings.ts --source=conversation_insights
 *   npx tsx scripts/backfill-embeddings.ts --reset-source=conversation_insights
 *   npx tsx scripts/backfill-embeddings.ts --reset-source=conversation_insights --source=conversation_insights
 *
 * Flags:
 *   --dry-run            Preview only — no embeddings written, shows enriched text
 *   --source=<name>      Process one source only
 *   --reset-source=<name> Set embedding=NULL for a source before backfilling
 *                         (use to re-embed rows that already have embeddings)
 *
 * Design:
 *   - Cursor-based pagination (fully resumable — safe to restart)
 *   - BATCH=20, SLEEP=300ms — avoids OpenAI rate limits
 *   - Never touches seed data — only writes to the `embedding` column
 *   - Cohort enrichment: role + department prepended to embedded text for
 *     conversation_insights, data_points, conversation_messages, capture_segments
 *
 * Column naming:
 *   Tables use @@map() for snake_case table names but fields have no @map(),
 *   so DB column names are camelCase (Prisma quotes them: "workshopId", etc.).
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
const resetSourceArg = process.argv.find((a) => a.startsWith('--reset-source='))?.split('=')[1];

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

// ─── Cohort text enrichment ───────────────────────────────────────────────────

/**
 * Prepend cohort context (role + department) to text so the vector carries
 * role signal. Safe for all attributionPreference values — role/department
 * is not personally identifying. Name is never included.
 *
 * Examples:
 *   "[Team Leader, Operations] Agents optimise for handle time not resolution"
 *   "[Agent, Contact Centre] I feel measured on compliance not outcomes"
 */
function buildEmbedText(
  text: string,
  role?: string | null,
  department?: string | null
): string {
  const prefix = [role, department].filter(Boolean).join(', ');
  return prefix ? `[${prefix}] ${text}` : text;
}

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

// ─── Reset helper ─────────────────────────────────────────────────────────────

async function resetEmbeddings(source: SourceName): Promise<void> {
  console.log(`\n⚠  Resetting embeddings for ${source}...`);
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "${source}" SET embedding = NULL`
  );
  console.log(`  ✓ Reset ${result} rows`);
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

type RawRow = {
  id: string;
  text: string;
  role?: string | null;
  department?: string | null;
};

async function backfillSource(source: SourceName): Promise<void> {
  console.log(`\n▶ ${source}`);
  let cursor = '';
  let total = 0;
  let errors = 0;

  while (true) {
    let rows: RawRow[] = [];

    if (source === 'discovery_themes') {
      // No participant attribution — theme-level, not individual
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT id,
               COALESCE("themeLabel" || ': ' || "themeDescription", "themeLabel") AS text
        FROM   discovery_themes
        WHERE  embedding IS NULL
          AND  id > ${cursor}
        ORDER  BY id
        LIMIT  ${BATCH}
      `;
    } else if (source === 'conversation_insights') {
      // JOIN to workshop_participants for role + department cohort context
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT ci.id,
               ci.text,
               wp.role,
               wp.department
        FROM   conversation_insights ci
        LEFT JOIN workshop_participants wp ON wp.id = ci."participantId"
        WHERE  ci.embedding IS NULL
          AND  ci.id > ${cursor}
        ORDER  BY ci.id
        LIMIT  ${BATCH}
      `;
    } else if (source === 'data_points') {
      // JOIN to workshop_participants for role + department cohort context
      // participantId is nullable on data_points
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT dp.id,
               dp."rawText" AS text,
               wp.role,
               wp.department
        FROM   data_points dp
        LEFT JOIN workshop_participants wp ON wp.id = dp."participantId"
        WHERE  dp.embedding IS NULL
          AND  dp.id > ${cursor}
        ORDER  BY dp.id
        LIMIT  ${BATCH}
      `;
    } else if (source === 'workshop_scratchpads') {
      // Fetch JSON blobs and extract text in JS.
      // No participant attribution — scratchpad is workshop-level
      const scratchpadRows = await prisma.$queryRaw<Array<{
        id: string;
        execSummary: unknown;
        discoveryOutput: unknown;
        reimagineContent: unknown;
        constraintsContent: unknown;
        potentialSolution: unknown;
        summaryContent: unknown;
      }>>`
        SELECT id,
               "execSummary",
               "discoveryOutput",
               "reimagineContent",
               "constraintsContent",
               "potentialSolution",
               "summaryContent"
        FROM   workshop_scratchpads
        WHERE  embedding IS NULL
          AND  id > ${cursor}
        ORDER  BY id
        LIMIT  ${BATCH}
      `;
      rows = scratchpadRows.map((r) => ({
        id: r.id,
        text: [
          extractJsonText(r.execSummary),
          extractJsonText(r.discoveryOutput),
          extractJsonText(r.reimagineContent),
          extractJsonText(r.constraintsContent),
          extractJsonText(r.potentialSolution),
          extractJsonText(r.summaryContent),
        ]
          .filter(Boolean)
          .join('\n'),
      })).filter((r) => r.text.length > 0);
    } else if (source === 'conversation_messages') {
      // JOIN through conversation_sessions → workshop_participants for cohort context
      rows = await prisma.$queryRaw<RawRow[]>`
        SELECT cm.id,
               cm.content AS text,
               wp.role,
               wp.department
        FROM   conversation_messages cm
        JOIN   conversation_sessions cs ON cs.id = cm."sessionId"
        LEFT JOIN workshop_participants wp ON wp.id = cs."participantId"
        WHERE  cm.embedding IS NULL
          AND  cm.role = 'PARTICIPANT'
          AND  cm.id > ${cursor}
        ORDER  BY cm.id
        LIMIT  ${BATCH}
      `;
    } else if (source === 'transcript_chunks') {
      // No participant attribution — transcript chunks are not per-participant
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
      const rawText = row.text?.trim();
      if (!rawText) {
        cursor = row.id;
        continue;
      }
      // Enrich text with cohort prefix where participant data is available
      const text = buildEmbedText(rawText, row.role, row.department);
      try {
        if (isDryRun) {
          console.log(`  [dry-run] ${row.id} — ${text.slice(0, 80)}…`);
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

  // Handle --reset-source before backfill
  if (resetSourceArg) {
    const validSources = ALL_SOURCES as readonly string[];
    if (!validSources.includes(resetSourceArg)) {
      console.error(`✗ Unknown reset-source: ${resetSourceArg}. Valid: ${ALL_SOURCES.join(', ')}`);
      process.exit(1);
    }
    if (isDryRun) {
      console.log(`[dry-run] Would reset embeddings for: ${resetSourceArg}`);
    } else {
      await resetEmbeddings(resetSourceArg as SourceName);
    }
  }

  const sources = sourceArg
    ? ALL_SOURCES.filter((s) => s === sourceArg)
    : resetSourceArg
      ? ALL_SOURCES.filter((s) => s === resetSourceArg)  // if only reset given, default to same source
      : ALL_SOURCES;

  if (sourceArg && sources.length === 0) {
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
