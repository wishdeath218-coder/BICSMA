-- Prevent one resident account from filing multiple reports in the same
-- active duplicate group. Claims are private and accessible only by service_role.
create table if not exists public.complaint_reporter_group_claims (
  account_id text not null references public.accounts(id) on delete cascade,
  group_id text not null,
  report_id text not null unique references public.complaints(id) on delete cascade,
  primary key (account_id, group_id)
);

insert into public.complaint_reporter_group_claims (account_id, group_id, report_id)
select account_id, group_id, report_id
from (
  select
    identity.account_id,
    coalesce(complaint.group_id, complaint.id) as group_id,
    identity.report_id,
    row_number() over (
      partition by identity.account_id, coalesce(complaint.group_id, complaint.id)
      order by complaint.created_at, complaint.id
    ) as claim_number
  from public.complaint_reporter_identities as identity
  join public.complaints as complaint on complaint.id = identity.report_id
  join public.accounts as account on account.id = identity.account_id
) as existing_claims
where claim_number = 1
on conflict do nothing;

alter table public.complaint_reporter_group_claims enable row level security;
revoke all on table public.complaint_reporter_group_claims from anon, authenticated, public;
grant all on table public.complaint_reporter_group_claims to service_role;
