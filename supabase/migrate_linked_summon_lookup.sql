create or replace function public.get_linked_summon_ids(
  p_account_id text,
  p_evidence_path text default null
)
returns table (summon_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select summon.id
  from public.summons as summon
  where (p_evidence_path is null or summon.evidence_photo = p_evidence_path)
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(summon.summoned_persons) = 'array' then summon.summoned_persons
          else '[]'::jsonb
        end
      ) as respondent(person)
      where respondent.person ->> 'accountId' = p_account_id
    );
$$;

revoke all on function public.get_linked_summon_ids(text, text) from public, anon, authenticated;
grant execute on function public.get_linked_summon_ids(text, text) to service_role;

notify pgrst, 'reload schema';
