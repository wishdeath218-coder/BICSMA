-- Run once in Supabase SQL Editor to move username/password authentication to
-- server-verified bcrypt hashes and opaque sessions.

begin;

create extension if not exists pgcrypto with schema extensions;
set local search_path = public, extensions;

alter table public.accounts
  add column if not exists role text not null default 'resident',
  add column if not exists barangay_position text,
  add column if not exists username text,
  add column if not exists password_hash text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'email'
  ) then
    execute $backfill$
      with account_names as (
        select
          id,
          coalesce(
            nullif(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), ''),
            'user_' || substr(md5(id), 1, 8)
          ) as base_username
        from public.accounts
        where username is null and email is not null
      ),
      ranked_names as (
        select
          id,
          base_username,
          row_number() over (partition by base_username order by id) as duplicate_number
        from account_names
      )
      update public.accounts as account
      set username = case
        when length(ranked_names.base_username) < 3
          then 'user_' || substr(md5(account.id), 1, 8)
        when ranked_names.duplicate_number = 1
          then left(ranked_names.base_username, 30)
        else left(ranked_names.base_username, 25) || '_' || ranked_names.duplicate_number::text
      end
      from ranked_names
      where account.id = ranked_names.id
    $backfill$;
  end if;
end
$$;

update public.accounts
set username = 'user_' || substr(md5(id), 1, 8)
where username is null;

alter table public.accounts alter column username set not null;
create unique index if not exists accounts_username_key on public.accounts (username);

create table if not exists public.auth_username_map (
  username text primary key references public.accounts(username) on delete cascade,
  auth_email text not null unique,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'email'
  ) then
    execute $mapping$
      insert into public.auth_username_map (username, auth_email)
      select username, lower(email)
      from public.accounts
      where email is not null
      on conflict (username) do update
      set auth_email = excluded.auth_email
    $mapping$;
  end if;
end
$$;

-- Keep existing Supabase Auth password hashes where accounts were already mapped.
update public.accounts as account
set password_hash = auth_user.encrypted_password
from public.auth_username_map as identity
join auth.users as auth_user
  on lower(auth_user.email) = lower(identity.auth_email)
where account.username = identity.username
  and account.password_hash is null
  and auth_user.encrypted_password is not null
  and auth_user.encrypted_password <> '';

-- Upgrade any legacy account passwords before removing the plaintext column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'password'
  ) then
    execute $hash_legacy$
      update public.accounts
      set password_hash = crypt(password, gen_salt('bf', 12))
      where password_hash is null and password is not null and password <> ''
    $hash_legacy$;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from public.accounts where password_hash is null) then
    raise exception 'Some accounts have no migratable password hash; resolve them before switching to custom authentication.';
  end if;
end
$$;

create table if not exists public.account_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references public.accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.account_login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists account_login_attempts_lookup_idx
  on public.account_login_attempts (username, ip_hash, attempted_at desc);

alter table public.account_sessions enable row level security;
alter table public.account_login_attempts enable row level security;
revoke all on table public.account_sessions from anon, authenticated;
revoke all on table public.account_login_attempts from anon, authenticated;
grant all on table public.account_sessions to service_role;
grant all on table public.account_login_attempts to service_role;

create or replace function public.hash_account_password(password_input text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select crypt(password_input, gen_salt('bf', 12));
$$;

create or replace function public.verify_account_password(username_input text, password_input text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select account.password_hash into stored_hash
  from public.accounts as account
  where account.username = lower(username_input);

  if stored_hash is null then
    perform crypt(password_input, gen_salt('bf', 12));
    return false;
  end if;

  return crypt(password_input, stored_hash) = stored_hash;
end;
$$;

create or replace function public.consume_account_login_attempt(username_input text, ip_hash_input text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recent_attempts integer;
begin
  perform pg_advisory_xact_lock(hashtext(username_input), hashtext(ip_hash_input));
  delete from public.account_login_attempts
  where attempted_at < now() - interval '15 minutes';

  select count(*) into recent_attempts
  from public.account_login_attempts
  where username = lower(username_input)
    and ip_hash = ip_hash_input
    and attempted_at >= now() - interval '15 minutes';

  if recent_attempts >= 10 then
    return false;
  end if;

  insert into public.account_login_attempts (username, ip_hash)
  values (lower(username_input), ip_hash_input);
  return true;
end;
$$;

revoke all on function public.hash_account_password(text) from public, anon, authenticated;
revoke all on function public.verify_account_password(text, text) from public, anon, authenticated;
revoke all on function public.consume_account_login_attempt(text, text) from public, anon, authenticated;
grant execute on function public.hash_account_password(text) to service_role;
grant execute on function public.verify_account_password(text, text) to service_role;
grant execute on function public.consume_account_login_attempt(text, text) to service_role;

alter table public.auth_username_map enable row level security;
revoke all on table public.auth_username_map from anon, authenticated;
grant all on table public.auth_username_map to service_role;

-- Credentials and sessions are service-role only; account operations go through
-- Edge Functions so clients cannot enumerate accounts or assign roles.
drop policy if exists "anon full access accounts" on public.accounts;
drop policy if exists "anon read accounts" on public.accounts;
revoke all on table public.accounts from anon, authenticated;
grant all on table public.accounts to service_role;

alter table public.accounts drop column if exists email;
alter table public.accounts drop column if exists password;
drop table if exists public.auth_username_map;

commit;
