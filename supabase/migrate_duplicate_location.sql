drop function if exists match_complaints(vector, text, double precision, integer);
drop function if exists match_complaints(vector, text, text, double precision, integer);

create function match_complaints(
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
    c.id,
    c.group_id,
    c.title,
    c.description,
    c.summary,
    c.category,
    c.location,
    c.status,
    c.date,
    1 - (c.embedding <=> query_embedding) as similarity
  from complaints c
  where
    c.embedding is not null
    and c.status <> 'Resolved'
    and c.status <> 'Rejected'
    and c.category = match_category
    and coalesce(lower(trim(c.location)), '') = coalesce(lower(trim(match_location)), '')
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

with mixed_location_groups as (
  select coalesce(group_id, id) as group_id
  from public.complaints
  group by coalesce(group_id, id)
  having count(distinct coalesce(lower(trim(location)), '')) > 1
),
location_representatives as (
  select
    complaint.id,
    first_value(complaint.id) over (
      partition by coalesce(complaint.group_id, complaint.id), coalesce(lower(trim(complaint.location)), '')
      order by case when complaint.id = complaint.group_id then 0 else 1 end, complaint.id
    ) as location_group_id
  from public.complaints as complaint
  join mixed_location_groups as mixed on mixed.group_id = coalesce(complaint.group_id, complaint.id)
)
update public.complaints as complaint
set group_id = representative.location_group_id
from location_representatives as representative
where complaint.id = representative.id
  and complaint.group_id <> representative.location_group_id;
