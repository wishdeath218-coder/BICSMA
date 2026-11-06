-- ═══════════════════════════════════════════════════════════════════════════
-- Give notifications an audience so residents and admin see separate lists.
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- audience values:
--   'admin'         → only the barangay admin sees it
--   'residents'     → all residents see it (e.g. new bulletin)
--   '<resident name>' → only that specific resident sees it (personal updates)
alter table notifications add column if not exists audience text default 'admin';

create index if not exists notifications_audience_idx on notifications (audience);

-- Best-effort backfill of existing rows based on where they point:
update notifications set audience = 'admin'
  where target_view in ('complaint-review', 'admin-resident-approvals');

update notifications set audience = 'residents'
  where target_view = 'community-feed';

-- Personal report updates: we can't recover the exact recipient for old rows,
-- so leave them as-is. New notifications will set audience correctly.
