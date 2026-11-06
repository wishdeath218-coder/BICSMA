-- ═══════════════════════════════════════════════════════════════════════════
-- Option B: AI summaries + issue grouping
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. AI-generated one-line summary (what the embedding is built from)
alter table complaints add column if not exists summary text;

-- 2. Group id — complaints about the same issue share this value.
--    A brand-new issue's group_id defaults to its own id.
alter table complaints add column if not exists group_id text;

-- Backfill group_id = id for any existing rows that don't have one yet
update complaints set group_id = id where group_id is null;

-- Fast lookups + grouping by issue
create index if not exists complaints_group_id_idx on complaints (group_id);

-- ─── Cascade status to every complaint in a group ────────────────────────────
-- When the admin reviews a grouped complaint, all members move together.
-- Appends a timeline entry to each affected complaint too.
create or replace function set_group_status(
  p_group_id text,
  p_status   text,
  p_note     text,
  p_reason   text default null
)
returns void
language sql
as $$
  update complaints
  set
    status = p_status,
    rejection_reason = coalesce(p_reason, rejection_reason),
    timeline = timeline || jsonb_build_array(
      jsonb_build_object(
        'status', p_status,
        'date', to_char(now() at time zone 'Asia/Manila', 'Mon DD, YYYY') || ' • cascade',
        'note', p_note
      )
    )
  where group_id = p_group_id;
$$;
