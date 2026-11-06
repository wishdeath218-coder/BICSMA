-- Barangay Bangbang Supabase schema.
create extension if not exists vector;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.accounts (
  id text primary key,
  username text not null unique,
  name text not null,
  role text not null default 'resident',
  barangay_position text,
  password_hash text,
  cp_number text,
  address text,
  registered_date text,
  verification_document_path text,
  status text not null default 'Pending',
  rejection_reason text,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-verification',
  'account-verification',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-images',
  'announcement-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-evidence',
  'report-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Allow announcement image uploads" on storage.objects;

create table if not exists public.account_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references public.accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.account_login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists account_login_attempts_lookup_idx
  on public.account_login_attempts (username, ip_hash, attempted_at desc);

create table if not exists public.complaints (
  id text primary key,
  group_id text,
  summary text,
  title text not null,
  category text not null,
  description text not null,
  location text,
  date text,
  status text not null default 'Pending',
  priority text not null default 'Normal',
  reported_by text,
  assignee text default 'Unassigned',
  evidence_photo text,
  rejection_reason text,
  timeline jsonb default '[]'::jsonb,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create table if not exists public.complaint_reporter_identities (
  report_id text primary key references public.complaints(id) on delete cascade,
  account_id text not null
);

create table if not exists public.complaint_reporter_group_claims (
  account_id text not null references public.accounts(id) on delete cascade,
  group_id text not null,
  report_id text not null unique references public.complaints(id) on delete cascade,
  primary key (account_id, group_id)
);

alter table public.complaint_reporter_group_claims enable row level security;
revoke all on table public.complaint_reporter_group_claims from anon, authenticated, public;
grant all on table public.complaint_reporter_group_claims to service_role;

create or replace function public.count_unique_complaint_reporters(p_group_id text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from (
    select 'account:' || identity.account_id as reporter_key
    from public.complaint_reporter_identities as identity
    join public.complaints as complaint on complaint.id = identity.report_id
    where complaint.group_id = p_group_id

    union

    select case
      when complaint.reported_by is null or complaint.reported_by = 'Anonymous'
        then 'unknown:' || complaint.id
      else 'name:' || lower(trim(complaint.reported_by))
    end as reporter_key
    from public.complaints as complaint
    where complaint.group_id = p_group_id
      and not exists (
        select 1
        from public.complaint_reporter_identities as identity
        where identity.report_id = complaint.id
      )
  ) as unique_reporters;
$$;

revoke all on function public.count_unique_complaint_reporters(text) from public, anon, authenticated;
grant execute on function public.count_unique_complaint_reporters(text) to service_role;

create table if not exists public.summons (
  id text primary key,
  title text not null,
  category text not null,
  description text not null,
  location text,
  date text,
  status text not null default 'Pending',
  priority text not null default 'Summon',
  reported_by text,
  assignee text default 'Unassigned',
  evidence_photo text,
  summoned_person_name text,
  summoned_person_address text,
  summoned_persons jsonb,
  summon_reason text,
  summon_notice_stage text,
  hearing_date text,
  hearing_slot_date date,
  hearing_slot_time text check (hearing_slot_time in ('09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00')),
  hearing_venue text,
  lupon_officer text,
  summon_notes jsonb default '[]'::jsonb,
  timeline jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists summons_hearing_slot_unique_idx
  on public.summons (hearing_slot_date, hearing_slot_time)
  where hearing_slot_date is not null and hearing_slot_time is not null;

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

create table if not exists public.announcements (
  id text primary key,
  title text not null,
  type text not null default 'News',
  date text,
  summary text,
  content text,
  image text,
  attachment text,
  urgent boolean default false,
  time_left text,
  engagement_count integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  title text not null,
  description text,
  date text,
  type text not null default 'system',
  is_read boolean default false,
  target_view text,
  target_id text,
  target_group_id text,
  audience text default 'admin',
  created_at timestamptz not null default now()
);

create or replace function public.notify_summoned_residents()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (
    id,
    title,
    description,
    date,
    type,
    is_read,
    target_view,
    target_id,
    audience
  )
  select
    'summon-' || new.id || '-' || recipient.id,
    'You Have Been Summoned',
    format(
      'You have been named as a summoned person in "%s". Open My Reports to view the case details.',
      new.title
    ),
    to_char(now(), 'Mon FMDD, YYYY'),
    'report',
    false,
    'my-reports',
    new.id,
    recipient.id
  from (
    select distinct account.id
    from jsonb_array_elements(
      case
        when jsonb_typeof(new.summoned_persons) = 'array' then new.summoned_persons
        else '[]'::jsonb
      end
    ) as respondent(person)
    join public.accounts as account
      on account.id = respondent.person ->> 'accountId'
    where account.role = 'resident'
      and account.status = 'Approved'
  ) as recipient
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_summoned_residents() from public, anon, authenticated;

drop trigger if exists summons_notify_linked_residents on public.summons;
create trigger summons_notify_linked_residents
  after insert on public.summons
  for each row
  execute function public.notify_summoned_residents();

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

alter table public.accounts enable row level security;
alter table public.account_sessions enable row level security;
alter table public.account_login_attempts enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_reporter_identities enable row level security;
revoke all on table public.complaint_reporter_identities from anon, authenticated, public;
grant all on table public.complaint_reporter_identities to service_role;
alter table public.summons enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.accounts from public, anon, authenticated;
revoke all on table public.account_sessions from public, anon, authenticated;
revoke all on table public.account_login_attempts from public, anon, authenticated;
revoke all on table public.complaints from anon, authenticated, public;
revoke all on table public.summons from anon, authenticated, public;
revoke all on table public.notifications from anon, authenticated, public;
revoke all on table public.admin_audit_log from anon, authenticated, public;
revoke all on table public.announcements from anon, authenticated, public;
grant all on table public.accounts to service_role;
grant all on table public.account_sessions to service_role;
grant all on table public.account_login_attempts to service_role;
grant all on table public.complaints to service_role;
grant all on table public.summons to service_role;
grant all on table public.notifications to service_role;
grant all on table public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;
grant all on table public.announcements to service_role;
grant select on table public.announcements to anon, authenticated;

create or replace function public.hash_account_password(password_input text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select crypt(password_input, gen_salt('bf', 12));
$$;

create or replace function public.verify_account_password(username_input text, password_input text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select account.password_hash into stored_hash
  from public.accounts as account
  where account.username = lower(username_input);

  if stored_hash is null then
    perform crypt(password_input, gen_salt('bf', 12));
    return false;
  end if;

  return crypt(password_input, stored_hash) = stored_hash;
end;
$$;

create or replace function public.consume_account_login_attempt(username_input text, ip_hash_input text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recent_attempts integer;
begin
  perform pg_advisory_xact_lock(hashtext(username_input), hashtext(ip_hash_input));
  delete from public.account_login_attempts
  where attempted_at < now() - interval '15 minutes';

  select count(*) into recent_attempts
  from public.account_login_attempts
  where username = lower(username_input)
    and ip_hash = ip_hash_input
    and attempted_at >= now() - interval '15 minutes';

  if recent_attempts >= 10 then
    return false;
  end if;

  insert into public.account_login_attempts (username, ip_hash)
  values (lower(username_input), ip_hash_input);
  return true;
end;
$$;

revoke all on function public.hash_account_password(text) from public, anon, authenticated;
revoke all on function public.verify_account_password(text, text) from public, anon, authenticated;
revoke all on function public.consume_account_login_attempt(text, text) from public, anon, authenticated;
grant execute on function public.hash_account_password(text) to service_role;
grant execute on function public.verify_account_password(text, text) to service_role;
grant execute on function public.consume_account_login_attempt(text, text) to service_role;

do $$
begin
  drop policy if exists "anon full access complaints" on public.complaints;
  drop policy if exists "anon full access announcements" on public.announcements;
  drop policy if exists "anon full access summons" on public.summons;
  drop policy if exists "anon full access notifications" on public.notifications;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'announcements'
      and policyname = 'public read announcements'
  ) then
    create policy "public read announcements"
      on public.announcements for select to anon, authenticated using (true);
  end if;
end
$$;

create index if not exists complaints_embedding_idx
  on public.complaints using ivfflat (embedding vector_cosine_ops) with (lists = 100);
