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
