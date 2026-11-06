alter table public.complaints
  add column if not exists summoned_person_name text,
  add column if not exists summoned_person_address text,
  add column if not exists summoned_persons jsonb,
  add column if not exists summon_reason text,
  add column if not exists summon_notice_stage text,
  add column if not exists hearing_date text,
  add column if not exists hearing_venue text,
  add column if not exists lupon_officer text,
  add column if not exists summon_notes jsonb default '[]'::jsonb;

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
  hearing_venue text,
  lupon_officer text,
  summon_notes jsonb default '[]'::jsonb,
  timeline jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.summons enable row level security;
grant all on table public.summons to anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'summons'
      and policyname = 'anon full access summons'
  ) then
    create policy "anon full access summons"
      on public.summons for all using (true) with check (true);
  end if;
end
$$;

insert into public.summons (
  id, title, category, description, location, date, status, priority,
  reported_by, assignee, evidence_photo, summoned_person_name,
  summoned_person_address, summoned_persons, summon_reason,
  summon_notice_stage, hearing_date, hearing_venue, lupon_officer,
  summon_notes, timeline, created_at
)
select
  id, title, category, description, location, date, status, 'Summon',
  reported_by, assignee, evidence_photo, summoned_person_name,
  summoned_person_address, summoned_persons, summon_reason,
  summon_notice_stage, hearing_date, hearing_venue, lupon_officer,
  summon_notes, timeline, created_at
from public.complaints
where priority = 'Summon'
   or summoned_person_name is not null
   or summoned_persons is not null
on conflict (id) do nothing;

update public.summons
set summoned_persons = jsonb_build_array(
  jsonb_strip_nulls(jsonb_build_object(
    'name', summoned_person_name,
    'address', nullif(summoned_person_address, '')
  ))
)
where summoned_persons is null
  and summoned_person_name is not null;

delete from public.complaints as complaint
where (
    complaint.priority = 'Summon'
    or complaint.summoned_person_name is not null
    or complaint.summoned_persons is not null
  )
  and exists (
    select 1 from public.summons as summon where summon.id = complaint.id
  );
