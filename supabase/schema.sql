-- Supabase Auth owns authentication records in auth.users. This table stores
-- the app-facing profile and mirrors each user's email automatically.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user();

grant select on public.profiles to authenticated;

-- Admin membership is maintained manually in the Supabase SQL Editor. Unlike
-- user-editable metadata, this table cannot be changed by app users.
create table if not exists public.joolo_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.joolo_admins enable row level security;
revoke all on public.joolo_admins from anon, authenticated;

create or replace function public.is_joolo_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.joolo_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_joolo_admin() from public, anon;
grant execute on function public.is_joolo_admin() to authenticated;

-- Only a SHA-256 hash is persisted. The original code is shown once and put
-- into the generated PDF; raw access codes cannot be recovered from the DB.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.joolo_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  constraint joolo_access_codes_expiry_after_creation
    check (expires_at > created_at)
);

alter table public.joolo_access_codes enable row level security;
revoke all on public.joolo_access_codes from anon, authenticated;
grant insert on public.joolo_access_codes to authenticated;

drop policy if exists "JOOLO admins can create access codes"
  on public.joolo_access_codes;
create policy "JOOLO admins can create access codes"
  on public.joolo_access_codes
  for insert
  to authenticated
  with check (
    (select public.is_joolo_admin())
    and (select auth.uid()) = created_by
  );

-- A future enrollment flow can call this RPC to redeem each code at most once.
create or replace function public.consume_joolo_access_code(input_code text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with consumed as (
    update public.joolo_access_codes
    set redeemed_at = now()
    where code_hash = encode(
      extensions.digest(upper(trim(input_code)), 'sha256'),
      'hex'
    )
      and redeemed_at is null
      and expires_at > now()
    returning id
  )
  select exists (select 1 from consumed);
$$;

revoke all on function public.consume_joolo_access_code(text) from public;
grant execute on function public.consume_joolo_access_code(text) to anon, authenticated;
