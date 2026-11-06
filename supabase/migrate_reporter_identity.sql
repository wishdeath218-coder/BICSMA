-- Store account identity separately from complaints so duplicate groups can
-- count unique residents without exposing account IDs through complaint reads.
create table if not exists public.complaint_reporter_identities (
  report_id text primary key references public.complaints(id) on delete cascade,
  account_id text not null
);

alter table public.complaint_reporter_identities enable row level security;
revoke all on table public.complaint_reporter_identities from anon, authenticated, public;
grant all on table public.complaint_reporter_identities to service_role;

-- Link older non-anonymous reports when the displayed name uniquely identifies
-- an account. Anonymous legacy rows cannot be safely associated after the fact.
insert into public.complaint_reporter_identities (report_id, account_id)
select complaint.id, account.id
from public.complaints as complaint
join public.accounts as account
  on lower(trim(account.name)) = lower(trim(complaint.reported_by))
where complaint.reported_by is not null
  and complaint.reported_by <> 'Anonymous'
  and not exists (
    select 1
    from public.accounts as other_account
    where lower(trim(other_account.name)) = lower(trim(complaint.reported_by))
      and other_account.id <> account.id
  )
on conflict (report_id) do nothing;

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
