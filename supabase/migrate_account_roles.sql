-- Run this in Supabase SQL Editor for projects created before account roles.
alter table accounts
  add column if not exists role text not null default 'resident';

alter table accounts
  add column if not exists barangay_position text;
