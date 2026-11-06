-- Remove the old aggregate reporter counter. Reports are now stored per
-- resident and counted through complaint_reporter_identities.
drop function if exists public.increment_report_count(text, text);

-- Recreate the matching RPC without its obsolete report_count result.
drop function if exists public.match_complaints(vector, text, double precision, integer);
drop function if exists public.match_complaints(vector, text, text, double precision, integer);

create function public.match_complaints(
  query_embedding vector(768),
  match_category text,
  match_location text,
  match_threshold float default 0.75,
  match_count int default 1
)
returns table (
  id text,
  group_id text,
  title text,
  description text,
  summary text,
  category text,
  location text,
  status text,
  date text,
  similarity float
)
language sql stable
as $$
  select
    complaint.id,
    complaint.group_id,
    complaint.title,
    complaint.description,
    complaint.summary,
    complaint.category,
    complaint.location,
    complaint.status,
    complaint.date,
    1 - (complaint.embedding <=> query_embedding) as similarity
  from public.complaints as complaint
  where complaint.embedding is not null
    and complaint.status not in ('Resolved', 'Rejected')
    and complaint.category = match_category
    and coalesce(lower(trim(complaint.location)), '') = coalesce(lower(trim(match_location)), '')
    and 1 - (complaint.embedding <=> query_embedding) > match_threshold
  order by complaint.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.complaints
  drop column if exists report_count,
  drop column if exists reporters;
