-- Document chunks: stores text content + embeddings for all uploaded artefacts
-- (PDFs, Word docs, images, video transcripts, handwritten notes, whiteboards)
-- Part of the Vector Embedding Layer for agentic memory + multimodal knowledge ingestion.
--
-- Note: The HNSW index on the embedding column must be created separately in Supabase
-- (after confirming pgvector extension is active):
--   CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
--     ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS "document_chunks" (
  "id"              TEXT          NOT NULL,
  "workshop_id"     TEXT          NOT NULL,
  "file_name"       TEXT          NOT NULL,
  "file_type"       TEXT          NOT NULL,
  "file_size_bytes" INTEGER       NOT NULL,
  "storage_key"     TEXT          NOT NULL,
  "chunk_index"     INTEGER       NOT NULL,
  "total_chunks"    INTEGER       NOT NULL,
  "content"         TEXT          NOT NULL,
  "page_number"     INTEGER,
  "artefact_type"   TEXT,
  "embedding"       vector(1536),
  "created_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_chunks_workshop_id_fkey"
    FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "document_chunks_workshop_id_idx"
  ON "document_chunks"("workshop_id");
