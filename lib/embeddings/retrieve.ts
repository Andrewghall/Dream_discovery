/**
 * lib/embeddings/retrieve.ts
 *
 * Semantic retrieval from the pgvector knowledge base.
 *
 * Data isolation: every query JOINs through workshops."organizationId" —
 * cross-org leakage is structurally impossible.
 *
 * Column naming:
 *   Tables with @@map() but no field @map() store columns in camelCase
 *   (Prisma quotes them: "workshopId", "themeLabel", etc.).
 *   The exception is document_chunks which uses @map() on every field
 *   and therefore has snake_case columns (workshop_id, etc.).
 *
 * Graceful degradation: if embedding or DB fails, returns [] and logs —
 * agents get no memory rather than a crash.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, type EmbeddableTable } from './embed';

export interface RetrievalOptions {
  /** Mandatory — data isolation boundary, no cross-org retrieval ever */
  organizationId: string;
  /** Restrict results TO one specific workshop */
  workshopId?: string;
  /** Exclude one workshop from results (e.g. current workshop for cross-workshop memory) */
  excludeWorkshopId?: string;
  /** Which tables to search (default: main discovery + synthesis sources) */
  sources?: EmbeddableTable[];
  /** Max results across all sources (default: 8) */
  topK?: number;
  /** Minimum cosine similarity 0–1 (default: 0.72) */
  minSimilarity?: number;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  source: EmbeddableTable;
  workshopId: string | null;
  similarity: number;
  /** Job role of the participant who produced this content (where known) */
  participantRole?: string | null;
  /** Department of the participant who produced this content (where known) */
  participantDepartment?: string | null;
  /** Cohort label for field capture sessions (actorRole from capture_sessions) */
  cohortLabel?: string | null;
}

const DEFAULT_SOURCES: EmbeddableTable[] = [
  'discovery_themes',
  'conversation_insights',
  'data_points',
  'workshop_scratchpads',
];

/**
 * Retrieve semantically relevant chunks from the knowledge base.
 * Returns at most `topK` results above `minSimilarity`, deduplicated.
 */
export async function retrieveRelevant(
  query: string,
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {
  const {
    organizationId,
    workshopId,
    excludeWorkshopId,
    sources = DEFAULT_SOURCES,
    topK = 8,
    minSimilarity = 0.72,
  } = options;

  try {
    const vector = await generateEmbedding(query);
    // pgvector literal: '[0.1,0.2,...]'
    const vectorLiteral = `[${vector.join(',')}]`;

    const queryOpts: QueryOpts = {
      organizationId,
      workshopId,
      excludeWorkshopId,
      topK,
      minSimilarity,
    };

    const queries = sources.map((source) => querySource(source, vectorLiteral, queryOpts));
    const resultsPerSource = await Promise.all(queries);
    const all = resultsPerSource.flat();

    // Deduplicate by first 120 chars of text
    const seen = new Set<string>();
    const deduped = all.filter((chunk) => {
      const key = chunk.text.slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by similarity descending, return topK
    deduped.sort((a, b) => b.similarity - a.similarity);
    return deduped.slice(0, topK);
  } catch (err) {
    console.error('[embeddings] retrieveRelevant failed:', err);
    return [];
  }
}

// ─── Per-source dispatch ─────────────────────────────────────────────────────

interface QueryOpts {
  organizationId: string;
  workshopId?: string;
  excludeWorkshopId?: string;
  topK: number;
  minSimilarity: number;
}

async function querySource(
  source: EmbeddableTable,
  vectorLiteral: string,
  opts: QueryOpts
): Promise<RetrievedChunk[]> {
  try {
    switch (source) {
      case 'conversation_insights':
        return queryConversationInsights(vectorLiteral, opts);
      case 'conversation_messages':
        return queryConversationMessages(vectorLiteral, opts);
      case 'discovery_themes':
        return queryDiscoveryThemes(vectorLiteral, opts);
      case 'raw_transcript_entries':
        return queryRawTranscriptEntries(vectorLiteral, opts);
      case 'data_points':
        return queryDataPoints(vectorLiteral, opts);
      case 'workshop_scratchpads':
        return queryWorkshopScratchpads(vectorLiteral, opts);
      case 'capture_segments':
        return queryCaptureSegments(vectorLiteral, opts);
      case 'document_chunks':
        return queryDocumentChunks(vectorLiteral, opts);
      default:
        return [];
    }
  } catch (err) {
    console.error(`[embeddings] querySource(${source}) failed:`, err);
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// SELECT aliases use "workshopId" so PG returns key workshopId in result objects
type RawRow = {
  id: string;
  text: string;
  workshopId: string | null;
  similarity: number;
  participantRole?: string | null;
  participantDepartment?: string | null;
  cohortLabel?: string | null;
};

function mapRows(source: EmbeddableTable, rows: RawRow[]): RetrievedChunk[] {
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    source,
    workshopId: r.workshopId,
    similarity: Number(r.similarity),
    participantRole: r.participantRole ?? null,
    participantDepartment: r.participantDepartment ?? null,
    cohortLabel: r.cohortLabel ?? null,
  }));
}

/**
 * Build optional workshop filter clauses for tables whose workshopId column is
 * camelCase (no @map on the field). Do NOT use for document_chunks which has
 * @map("workshop_id") — handle that table's filters inline.
 */
function buildWorkshopFilters(alias: string, opts: QueryOpts) {
  const wFilter = opts.workshopId
    ? Prisma.sql`AND ${Prisma.raw(`${alias}."workshopId"`)} = ${opts.workshopId}`
    : Prisma.empty;
  const exFilter = opts.excludeWorkshopId
    ? Prisma.sql`AND ${Prisma.raw(`${alias}."workshopId"`)} != ${opts.excludeWorkshopId}`
    : Prisma.empty;
  return { wFilter, exFilter };
}

// ─── Individual table queries ─────────────────────────────────────────────────

async function queryConversationInsights(v: string, opts: QueryOpts): Promise<RetrievedChunk[]> {
  const { wFilter, exFilter } = buildWorkshopFilters('ci', opts);
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT ci.id,
           ci.text,
           ci."workshopId"                                        AS "workshopId",
           (1 - (ci.embedding <=> ${v}::vector))::float8         AS similarity,
           wp.role                                                AS "participantRole",
           wp.department                                          AS "participantDepartment"
    FROM   conversation_insights ci
    JOIN   workshops w ON w.id = ci."workshopId"
    LEFT JOIN workshop_participants wp ON wp.id = ci."participantId"
    WHERE  w."organizationId" = ${opts.organizationId}
      AND  ci.embedding IS NOT NULL
      AND  (1 - (ci.embedding <=> ${v}::vector)) > ${opts.minSimilarity}
      ${wFilter}
      ${exFilter}
    ORDER  BY ci.embedding <=> ${v}::vector
    LIMIT  ${opts.topK}
  `);
  return mapRows('conversation_insights', rows);
}

async function queryConversationMessages(v: string, opts: QueryOpts): Promise<RetrievedChunk[]> {
  // conversation_messages.sessionId → conversation_sessions → workshop_participants
  const wFilter = opts.workshopId
    ? Prisma.sql`AND cs."workshopId" = ${opts.workshopId}`
    : Prisma.empty;
  const exFilter = opts.excludeWorkshopId
    ? Prisma.sql`AND cs."workshopId" != ${opts.excludeWorkshopId}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT cm.id,
           cm.content                                             AS text,
           cs."workshopId"                                        AS "workshopId",
           (1 - (cm.embedding <=> ${v}::vector))::float8         AS similarity,
           wp.role                                                AS "participantRole",
           wp.department                                          AS "participantDepartment"
    FROM   conversation_messages cm
    JOIN   conversation_sessions cs ON cs.id = cm."sessionId"
    JOIN   workshops w ON w.id = cs."workshopId"
    LEFT JOIN workshop_participants wp ON wp.id = cs."participantId"
    WHERE  w."organizationId" = ${opts.organizationId}
      AND  cm.role = 'PARTICIPANT'
      AND  cm.embedding IS NOT NULL
      AND  (1 - (cm.embedding <=> ${v}::vector)) > ${opts.minSimilarity}
      ${wFilter}
      ${exFilter}
    ORDER  BY cm.embedding <=> ${v}::vector
    LIMIT  ${opts.topK}
  `);
  return mapRows('conversation_messages', rows);
}

async function queryDiscoveryThemes(v: string, opts: QueryOpts): Promise<RetrievedChunk[]> {
  const { wFilter, exFilter } = buildWorkshopFilters('dt', opts);
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT dt.id,
           COALESCE(dt."themeLabel" || ': ' || dt."themeDescription", dt."themeLabel") AS text,
           dt."workshopId"                                        AS "workshopId",
           (1 - (dt.embedding <=> ${v}::vector))::float8         AS similarity
    FROM   discovery_themes dt
    JOIN   workshops w ON w.id = dt."workshopId"
    WHERE  w."organizationId" = ${opts.organizationId}
      AND  dt.embedding IS NOT NULL
      AND  (1 - (dt.embedding <=> ${v}::vector)) > ${opts.minSimilarity}
      ${wFilter}
      ${exFilter}
    ORDER  BY dt.embedding <=> ${v}::vector
    LIMIT  ${opts.topK}
  `);
  return mapRows('discovery_themes', rows);
}

async function queryRawTranscriptEntries(v: string, opts: QueryOpts): Promise<RetrievedChunk[]> {
  const { wFilter, exFilter } = buildWorkshopFilters('tc', opts);
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT tc.id,
           tc.text,
           tc."workshopId"                                        AS "workshopId",
           (1 - (tc.embedding <=> ${v}::vector))::float8         AS similarity
    FROM   raw_transcript_entries tc
    JOIN   workshops w ON w.id = tc."workshopId"
    WHERE  w."organizationId" = ${opts.organizationId}
      AND  tc.embedding IS NOT NULL
      AND  (1 - (tc.embedding <=> ${v}::vector)) > ${opts.minSimilarity}
      ${wFilter}
      ${exFilter}
    ORDER  BY tc.embedding <=> ${v}::vector
    LIMIT  ${opts.topK}
  `);
  return mapRows('raw_transcript_entries', rows);
}

async function queryDataPoints(v: string, opts: QueryOpts): Promise<RetrievedChunk[]> {
  const { wFilter, exFilter } = buildWorkshopFilters('dp', opts);
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT dp.id,
           dp."rawText"                                           AS text,
           dp."workshopId"                                        AS "workshopId",
           (1 - (dp.embedding <=> ${v}::vector))::float8         AS similarity,
           wp.role                                                AS "participantRole",
           wp.department                                          AS "participantDepartment"
    FROM   data_points dp
    JOIN   workshops w ON w.id = dp."workshopId"
    LEFT JOIN workshop_participants wp ON wp.id = dp."participantId"
    WHERE  w."organizationId" = ${opts.organizationId}
      AND  dp.embedding IS NOT NULL
      AND  (1 - (dp.embedding <=> ${v}::vector)) > ${opts.minSimilarity}
      ${wFilter}
      ${exFilter}
    ORDER  BY dp.embedding <=> ${v}::vector
    LIMIT  ${opts.topK}
  `);
  return mapRows('data_points', rows);
}

async function queryWorkshopScratchpads(v: string, opts: QueryOpts): Promise<RetrievedChunk[]> {
  // Scratchpad has no single plain-text field — text returned is workshop context.
  // Semantic similarity still finds relevant workshops via the full embedded synthesis dump.
  const { wFilter, exFilter } = buildWorkshopFilters('ws', opts);
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT ws.id,
           COALESCE(w.name, 'Workshop') || ' (' || COALESCE(w.industry, 'unspecified industry') || ') — synthesised output' AS text,
           ws."workshopId"                                        AS "workshopId",
           (1 - (ws.embedding <=> ${v}::vector))::float8         AS similarity
    FROM   workshop_scratchpads ws
    JOIN   workshops w ON w.id = ws."workshopId"
    WHERE  w."organizationId" = ${opts.organizationId}
      AND  ws.embedding IS NOT NULL
      AND  (1 - (ws.embedding <=> ${v}::vector)) > ${opts.minSimilarity}
      ${wFilter}
      ${exFilter}
    ORDER  BY ws.embedding <=> ${v}::vector
    LIMIT  ${opts.topK}
  `);
  return mapRows('workshop_scratchpads', rows);
}

async function queryCaptureSegments(v: string, opts: QueryOpts): Promise<RetrievedChunk[]> {
  // capture_segments.captureSessionId → capture_sessions.workshopId (both camelCase, no @map)
  // actorRole and department from capture_sessions provide cohort identity for field interviews
  const wFilter = opts.workshopId
    ? Prisma.sql`AND cap."workshopId" = ${opts.workshopId}`
    : Prisma.empty;
  const exFilter = opts.excludeWorkshopId
    ? Prisma.sql`AND cap."workshopId" != ${opts.excludeWorkshopId}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT seg.id,
           seg.transcript                                         AS text,
           cap."workshopId"                                       AS "workshopId",
           (1 - (seg.embedding <=> ${v}::vector))::float8        AS similarity,
           cap."actorRole"                                        AS "cohortLabel",
           cap.department                                         AS "participantDepartment"
    FROM   capture_segments seg
    JOIN   capture_sessions cap ON cap.id = seg."captureSessionId"
    JOIN   workshops w ON w.id = cap."workshopId"
    WHERE  w."organizationId" = ${opts.organizationId}
      AND  seg.embedding IS NOT NULL
      AND  (1 - (seg.embedding <=> ${v}::vector)) > ${opts.minSimilarity}
      ${wFilter}
      ${exFilter}
    ORDER  BY seg.embedding <=> ${v}::vector
    LIMIT  ${opts.topK}
  `);
  return mapRows('capture_segments', rows);
}

async function queryDocumentChunks(v: string, opts: QueryOpts): Promise<RetrievedChunk[]> {
  // document_chunks uses @map() on every field → all DB columns are snake_case.
  // Inline filters here rather than using buildWorkshopFilters.
  const wFilter = opts.workshopId
    ? Prisma.sql`AND dc.workshop_id = ${opts.workshopId}`
    : Prisma.empty;
  const exFilter = opts.excludeWorkshopId
    ? Prisma.sql`AND dc.workshop_id != ${opts.excludeWorkshopId}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT dc.id,
           dc.content                                             AS text,
           dc.workshop_id                                         AS "workshopId",
           (1 - (dc.embedding <=> ${v}::vector))::float8         AS similarity
    FROM   document_chunks dc
    JOIN   workshops w ON w.id = dc.workshop_id
    WHERE  w."organizationId" = ${opts.organizationId}
      AND  dc.embedding IS NOT NULL
      AND  (1 - (dc.embedding <=> ${v}::vector)) > ${opts.minSimilarity}
      ${wFilter}
      ${exFilter}
    ORDER  BY dc.embedding <=> ${v}::vector
    LIMIT  ${opts.topK}
  `);
  return mapRows('document_chunks', rows);
}
