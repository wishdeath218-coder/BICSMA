-- ═══════════════════════════════════════════════════════════════════════════
-- [ARCHIVAL — one-time migration, already applied]
-- Migrate embeddings from OpenAI (1536 dims) to Gemini (768 dims).
-- Kept for history only. schema.sql now defines embedding as vector(768)
-- directly, so a fresh setup does NOT need this. Do not re-run on a live DB
-- unless you are intentionally resetting all embeddings.
-- Run (only if needed) in: Supabase Dashboard → SQL Editor → New query.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the old vector index (it's tied to the 1536-dim column)
drop index if exists complaints_embedding_idx;

-- Clear any existing embeddings and resize the column to 768 dims (Gemini)
alter table complaints drop column if exists embedding;
alter table complaints add column embedding vector(768);

-- Recreate the similarity index for the new dimension
create index if not exists complaints_embedding_idx
  on complaints using ivfflat (embedding vector_cosine_ops) with (lists = 100);
