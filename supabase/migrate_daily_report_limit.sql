alter table public.accounts add column if not exists blocked_until timestamptz;

create table if not exists public.report_daily_submissions (
  id bigint generated always as identity primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  report_id text not null,
  submitted_at timestamptz not null default now(),
  unique (account_id, report_id)
);

create index if not exists report_daily_submissions_account_time_idx
  on public.report_daily_submissions (account_id, submitted_at desc);

alter table public.report_daily_submissions enable row level security;
revoke all on table public.report_daily_submissions from anon, authenticated, public;
grant all on table public.report_daily_submissions to service_role;

create or replace function public.consume_daily_report_slot(
  p_account_id text,
  p_report_id text,
  p_daily_limit integer default 3
)
returns table (allowed boolean, used integer, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamptz;
  next_day timestamptz;
  submitted_count integer;
begin
  if p_daily_limit < 1 or p_report_id is null or p_report_id = '' then
    raise exception 'Invalid daily report limit request';
  end if;

  perform pg_advisory_xact_lock(hashtext('daily-report-limit'), hashtext(p_account_id));

  day_start := (now() at time zone 'Asia/Manila')::date::timestamp
    at time zone 'Asia/Manila';
  next_day := day_start + interval '1 day';

  select count(*)::integer into submitted_count
  from public.report_daily_submissions
  where account_id = p_account_id
    and submitted_at >= day_start
    and submitted_at < next_day;

  if submitted_count >= p_daily_limit then
    return query select false, submitted_count, 0, next_day;
    return;
  end if;

  insert into public.report_daily_submissions (account_id, report_id)
  values (p_account_id, p_report_id);

  return query select true, submitted_count + 1, p_daily_limit - submitted_count - 1, next_day;
end;
$$;

create or replace function public.get_daily_report_usage(p_account_id text)
returns table (used integer, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamptz;
  next_day timestamptz;
  submitted_count integer;
begin
  day_start := (now() at time zone 'Asia/Manila')::date::timestamp
    at time zone 'Asia/Manila';
  next_day := day_start + interval '1 day';

  select count(*)::integer into submitted_count
  from public.report_daily_submissions
  where account_id = p_account_id
    and submitted_at >= day_start
    and submitted_at < next_day;

  return query select submitted_count, greatest(3 - submitted_count, 0), next_day;
end;
$$;

create or replace function public.release_daily_report_slot(
  p_account_id text,
  p_report_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.report_daily_submissions
  where account_id = p_account_id and report_id = p_report_id;
$$;

revoke all on function public.consume_daily_report_slot(text, text, integer) from public, anon, authenticated;
revoke all on function public.get_daily_report_usage(text) from public, anon, authenticated;
revoke all on function public.release_daily_report_slot(text, text) from public, anon, authenticated;
grant execute on function public.consume_daily_report_slot(text, text, integer) to service_role;
grant execute on function public.get_daily_report_usage(text) to service_role;
grant execute on function public.release_daily_report_slot(text, text) to service_role;
