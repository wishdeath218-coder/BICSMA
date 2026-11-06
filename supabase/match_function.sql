-- ═══════════════════════════════════════════════════════════════════════════
-- AI duplicate detection — similarity search function
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop previous signatures before changing match parameters.
drop function if exists match_complaints(vector, text, double precision, integer);
drop function if exists match_complaints(vector, text, text, double precision, integer);

-- Returns active complaints in the same category whose embedding is similar
-- (above `match_threshold`) to the query embedding, most similar first.
create or replace function match_complaints(
  query_embedding vector(768),
  match_category  text,
  match_location  text,
  match_threshold float default 0.75,
  match_count     int default 1
)
returns table (
  id           text,
  group_id     text,
  title        text,
  description  text,
  summary      text,
  category     text,
  location     text,
  status       text,
  date         text,
  similarity   float
)
language sql stable
as $$
  select
    c.id,
    c.group_id,
    c.title,
    c.description,
    c.summary,
    c.category,
    c.location,
    c.status,
    c.date,
    1 - (c.embedding <=> query_embedding) as similarity
  from complaints c
  where
    c.embedding is not null
    and c.status <> 'Resolved'
    and c.status <> 'Rejected'
    and c.category = match_category
    and coalesce(lower(trim(c.location)), '') = coalesce(lower(trim(match_location)), '')
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
