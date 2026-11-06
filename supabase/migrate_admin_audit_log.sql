-- Apply this additive migration before deploying app-data and updated auth functions.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id text not null,
  actor_name text not null,
  action text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant all on table public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;
