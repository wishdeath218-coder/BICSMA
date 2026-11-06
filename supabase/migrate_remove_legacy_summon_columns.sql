-- Move any remaining legacy summons from complaints before dropping the
-- summons-only columns. Run migrate_summons_table.sql first.
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

do $$
begin
  if exists (
    select 1
    from public.complaints as complaint
    where (
        complaint.priority = 'Summon'
        or complaint.summoned_person_name is not null
        or complaint.summoned_persons is not null
      )
      and not exists (
        select 1
        from public.summons as summon
        where summon.id = complaint.id
      )
  ) then
    raise exception 'Legacy summons remain in complaints without a matching row in summons; no columns were dropped.';
  end if;
end
$$;

delete from public.complaints as complaint
where (
    complaint.priority = 'Summon'
    or complaint.summoned_person_name is not null
    or complaint.summoned_persons is not null
  )
  and exists (
    select 1
    from public.summons as summon
    where summon.id = complaint.id
  );

alter table public.complaints
  drop column if exists summoned_person_name,
  drop column if exists summoned_person_address,
  drop column if exists summoned_persons,
  drop column if exists summon_reason,
  drop column if exists summon_notice_stage,
  drop column if exists hearing_date,
  drop column if exists hearing_venue,
  drop column if exists lupon_officer,
  drop column if exists summon_notes;
