alter table public.complaints
  add column if not exists summoned_persons jsonb;
