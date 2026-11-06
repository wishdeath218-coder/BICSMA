alter table public.accounts
  add column if not exists verification_document_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-verification',
  'account-verification',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
