-- Route account-specific data access through the session-verified app-data Edge Function.
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
alter table public.complaints enable row level security;
alter table public.summons enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "anon full access complaints" on public.complaints;
drop policy if exists "anon full access summons" on public.summons;
drop policy if exists "anon full access notifications" on public.notifications;
drop policy if exists "anon full access announcements" on public.announcements;
drop policy if exists "public read announcements" on public.announcements;
drop policy if exists "Allow announcement image uploads" on storage.objects;

revoke all on table public.accounts from public, anon, authenticated;
revoke all on table public.account_sessions from public, anon, authenticated;
revoke all on table public.account_login_attempts from public, anon, authenticated;
revoke all on table public.complaints from public, anon, authenticated;
revoke all on table public.summons from public, anon, authenticated;
revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.admin_audit_log from public, anon, authenticated;
revoke all on table public.announcements from public, anon, authenticated;
revoke all on table public.complaint_reporter_identities from public, anon, authenticated;
revoke all on table public.complaint_reporter_group_claims from public, anon, authenticated;

grant all on table public.accounts to service_role;
grant all on table public.account_sessions to service_role;
grant all on table public.account_login_attempts to service_role;
grant all on table public.complaints to service_role;
grant all on table public.summons to service_role;
grant all on table public.notifications to service_role;
grant all on table public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;
grant all on table public.announcements to service_role;
grant all on table public.complaint_reporter_identities to service_role;
grant all on table public.complaint_reporter_group_claims to service_role;
grant select on table public.announcements to anon, authenticated;

create or replace function public.assign_reports(p_report_ids text[], p_assignee text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
  summons_count integer;
  expected_count integer;
begin
  expected_count = cardinality(coalesce(p_report_ids, array[]::text[]));
  if expected_count = 0 then
    raise exception 'Select at least one report to assign.';
  end if;

  update public.complaints
  set assignee = p_assignee
  where id = any(coalesce(p_report_ids, array[]::text[]));
  get diagnostics updated_count = row_count;

  update public.summons
  set assignee = p_assignee
  where id = any(coalesce(p_report_ids, array[]::text[]));
  get diagnostics summons_count = row_count;

  if updated_count + summons_count <> expected_count then
    raise exception 'One or more reports could not be found for assignment.';
  end if;

  return updated_count + summons_count;
end;
$$;

revoke all on function public.assign_reports(text[], text) from public, anon, authenticated;
grant execute on function public.assign_reports(text[], text) to service_role;

create policy "public read announcements"
  on public.announcements for select to anon, authenticated using (true);
