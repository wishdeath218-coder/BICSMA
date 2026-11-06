alter table public.summons
  add column if not exists hearing_slot_date date,
  add column if not exists hearing_slot_time text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'summons_hearing_slot_time_check'
      and conrelid = 'public.summons'::regclass
  ) then
    alter table public.summons
      add constraint summons_hearing_slot_time_check
      check (hearing_slot_time in ('09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'));
  end if;
end;
$$;

with parsed_slots as (
  select
    id,
    to_timestamp(hearing_date, 'Mon FMDD, YYYY "•" HH12:MI AM') as slot,
    created_at
  from public.summons
  where hearing_date ~ '^[A-Za-z]{3} [0-9]{1,2}, [0-9]{4} • [0-9]{1,2}:[0-9]{2} (AM|PM)$'
    and hearing_slot_date is null
    and hearing_slot_time is null
    and to_char(to_timestamp(hearing_date, 'Mon FMDD, YYYY "•" HH12:MI AM'), 'HH24:MI')
      in ('09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00')
),
ranked_slots as (
  select
    id,
    slot::date as slot_date,
    to_char(slot, 'HH24:MI') as slot_time,
    row_number() over (
      partition by slot::date, to_char(slot, 'HH24:MI')
      order by created_at, id
    ) as slot_rank
  from parsed_slots
)
update public.summons as summon
set hearing_slot_date = ranked.slot_date,
    hearing_slot_time = ranked.slot_time
from ranked_slots as ranked
where summon.id = ranked.id
  and ranked.slot_rank = 1;

with parsed_slots as (
  select
    id,
    to_timestamp(hearing_date, 'Mon FMDD, YYYY "•" HH12:MI AM') as slot,
    created_at
  from public.summons
  where hearing_date ~ '^[A-Za-z]{3} [0-9]{1,2}, [0-9]{4} • [0-9]{1,2}:[0-9]{2} (AM|PM)$'
    and hearing_slot_date is null
    and hearing_slot_time is null
),
ranked_slots as (
  select
    id,
    slot::date as slot_date,
    to_char(slot, 'HH24:MI') as slot_time,
    row_number() over (
      partition by slot::date, to_char(slot, 'HH24:MI')
      order by created_at, id
    ) as slot_rank
  from parsed_slots
)
update public.summons as summon
set hearing_slot_date = ranked.slot_date,
    hearing_slot_time = ranked.slot_time
from ranked_slots as ranked
where summon.id = ranked.id
  and ranked.slot_rank = 1;

create unique index if not exists summons_hearing_slot_unique_idx
  on public.summons (hearing_slot_date, hearing_slot_time)
  where hearing_slot_date is not null and hearing_slot_time is not null;
