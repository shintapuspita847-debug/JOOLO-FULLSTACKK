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
  reserved_email text,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  constraint joolo_access_codes_expiry_after_creation
    check (expires_at > created_at)
);

alter table public.joolo_access_codes
  add column if not exists redeemed_by uuid references auth.users (id) on delete set null;

alter table public.joolo_access_codes
  add column if not exists reserved_email text;

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists gender text,
  add column if not exists age_group text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists access_code_id uuid unique
    references public.joolo_access_codes (id) on delete restrict;

alter table public.profiles
  drop constraint if exists profiles_gender_check;
alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('woman', 'man'));

alter table public.profiles
  drop constraint if exists profiles_age_group_check;
alter table public.profiles
  add constraint profiles_age_group_check
  check (age_group is null or age_group in ('under_18', '18_25', 'over_25'));

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

-- Claims a code and saves the onboarding profile as one atomic transaction.
-- Locking the code row prevents two users from redeeming it concurrently.
drop function if exists public.consume_joolo_access_code(text);

create or replace function public.claim_joolo_access_code(
  input_code text,
  input_full_name text,
  input_gender text,
  input_age_group text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  normalized_name text := regexp_replace(trim(coalesce(input_full_name, '')), '\s+', ' ', 'g');
  matched_code_id uuid;
begin
  if current_user_id is null then
    return 'unauthorized';
  end if;

  perform 1
    from auth.users
   where id = current_user_id
   for update;

  select email
    into current_user_email
    from auth.users
   where id = current_user_id;

  if current_user_email is null then
    return 'unauthorized';
  end if;

  if char_length(normalized_name) < 2
     or char_length(normalized_name) > 100
     or coalesce(input_gender, '') not in ('woman', 'man')
     or coalesce(input_age_group, '') not in ('under_18', '18_25', 'over_25')
     or coalesce(input_code, '') !~* '^JOOLO(-[A-Z0-9]{4}){3}(-[A-Z0-9]{4}){0,3}$' then
    return 'invalid_profile';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = current_user_id
      and onboarding_completed_at is not null
  ) then
    return 'already_onboarded';
  end if;

  select id
    into matched_code_id
    from public.joolo_access_codes
   where code_hash = encode(
       extensions.digest(upper(trim(input_code)), 'sha256'),
       'hex'
     )
     and redeemed_at is null
     and expires_at > now()
     and (
       reserved_email is null
       or lower(trim(reserved_email)) = lower(trim(current_user_email))
     )
   for update;

  if matched_code_id is null then
    return 'invalid_code';
  end if;

  update public.joolo_access_codes
     set redeemed_at = now(),
         redeemed_by = current_user_id
   where id = matched_code_id;

  insert into public.profiles (
    id,
    email,
    full_name,
    gender,
    age_group,
    onboarding_completed_at,
    access_code_id
  )
  select
    current_user_id,
    auth_user.email,
    normalized_name,
    input_gender,
    input_age_group,
    now(),
    matched_code_id
  from auth.users as auth_user
  where auth_user.id = current_user_id
  on conflict (id) do update
    set full_name = excluded.full_name,
        gender = excluded.gender,
        age_group = excluded.age_group,
        onboarding_completed_at = excluded.onboarding_completed_at,
        access_code_id = excluded.access_code_id,
        updated_at = now();

  return 'claimed';
end;
$$;

revoke all on function public.claim_joolo_access_code(text, text, text, text)
  from public, anon;
grant execute on function public.claim_joolo_access_code(text, text, text, text)
  to authenticated;

-- Lynk.id webhook deliveries are idempotent by payment ref. The raw code is
-- retained only until Brevo accepts the transactional email, then erased.
create table if not exists public.lynk_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  lynk_payment_ref text not null unique,
  lynk_message_id text not null,
  buyer_email text not null,
  product_title text not null,
  amount bigint not null check (amount >= 0),
  access_code_id uuid unique
    references public.joolo_access_codes (id) on delete restrict,
  access_code_for_delivery text,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sending', 'sent', 'failed')),
  email_lease_until timestamptz,
  email_sent_at timestamptz,
  last_email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lynk_purchase_orders enable row level security;
revoke all on public.lynk_purchase_orders from public, anon, authenticated;
grant all on public.lynk_purchase_orders to service_role;

create or replace function public.prepare_lynk_access_code(
  input_payment_ref text,
  input_message_id text,
  input_buyer_email text,
  input_product_title text,
  input_amount bigint,
  input_code_hash text,
  input_raw_code text
)
returns table (
  order_id uuid,
  raw_code text,
  email_already_sent boolean,
  delivery_in_progress boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_admin_id uuid;
  v_access_code_id uuid;
  v_status text;
  v_raw_code text;
  v_buyer_email text;
  v_lease_until timestamptz;
  v_attempt integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if coalesce(input_payment_ref, '') = ''
     or coalesce(input_message_id, '') = ''
     or lower(coalesce(input_buyer_email, '')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or char_length(input_buyer_email) > 254
     or coalesce(input_product_title, '') = ''
     or input_amount is null
     or input_amount < 0
     or coalesce(input_code_hash, '') !~ '^[a-f0-9]{64}$'
     or coalesce(input_raw_code, '') !~* '^JOOLO(-[A-Z0-9]{4}){6}$' then
    raise exception 'Invalid Lynk purchase data';
  end if;

  for v_attempt in 1..2 loop
    select p.id, p.email_status, p.access_code_for_delivery,
           p.buyer_email, p.email_lease_until
      into v_order_id, v_status, v_raw_code, v_buyer_email, v_lease_until
      from public.lynk_purchase_orders as p
     where p.lynk_payment_ref = input_payment_ref
     for update;

    if found then
      if lower(v_buyer_email) <> lower(input_buyer_email) then
        raise exception 'Payment reference email mismatch';
      end if;

      if v_status = 'sent' then
        return query select v_order_id, null::text, true, false;
        return;
      end if;

      if v_status = 'sending' and v_lease_until > now() then
        return query select v_order_id, null::text, false, true;
        return;
      end if;

      if v_raw_code is null then
        raise exception 'Pending Lynk purchase has no access code';
      end if;

      update public.lynk_purchase_orders
         set email_status = 'sending',
             email_lease_until = now() + interval '2 minutes',
             updated_at = now()
       where id = v_order_id;

      return query select v_order_id, v_raw_code, false, false;
      return;
    end if;

    select a.user_id
      into v_admin_id
      from public.joolo_admins as a
     order by a.created_at
     limit 1;

    if v_admin_id is null then
      raise exception 'No JOOLO admin is configured';
    end if;

    insert into public.lynk_purchase_orders (
      lynk_payment_ref,
      lynk_message_id,
      buyer_email,
      product_title,
      amount,
      access_code_for_delivery,
      email_status,
      email_lease_until
    )
    values (
      input_payment_ref,
      input_message_id,
      lower(trim(input_buyer_email)),
      input_product_title,
      input_amount,
      input_raw_code,
      'sending',
      now() + interval '2 minutes'
    )
    on conflict (lynk_payment_ref) do nothing
    returning id into v_order_id;

    if v_order_id is null then
      continue;
    end if;

    insert into public.joolo_access_codes (
      code_hash,
      created_by,
      expires_at,
      reserved_email
    )
    values (
      input_code_hash,
      v_admin_id,
      now() + interval '6 months',
      lower(trim(input_buyer_email))
    )
    returning id into v_access_code_id;

    update public.lynk_purchase_orders
       set access_code_id = v_access_code_id
     where id = v_order_id;

    return query select v_order_id, input_raw_code, false, false;
    return;
  end loop;

  raise exception 'Could not acquire Lynk purchase order';
end;
$$;

create or replace function public.mark_lynk_email_sent(input_order_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  update public.lynk_purchase_orders
     set email_status = 'sent',
         access_code_for_delivery = null,
         email_lease_until = null,
         email_sent_at = now(),
         last_email_error = null,
         updated_at = now()
   where id = input_order_id
     and email_status = 'sending';

  return found;
end;
$$;

create or replace function public.mark_lynk_email_failed(
  input_order_id uuid,
  input_error text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  update public.lynk_purchase_orders
     set email_status = 'failed',
         email_lease_until = null,
         last_email_error = left(coalesce(input_error, 'Email delivery failed'), 500),
         updated_at = now()
   where id = input_order_id
     and email_status = 'sending';

  return found;
end;
$$;

revoke all on function public.prepare_lynk_access_code(text, text, text, text, bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.mark_lynk_email_sent(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_lynk_email_failed(uuid, text)
  from public, anon, authenticated;
grant execute on function public.prepare_lynk_access_code(text, text, text, text, bigint, text, text)
  to service_role;
grant execute on function public.mark_lynk_email_sent(uuid)
  to service_role;
grant execute on function public.mark_lynk_email_failed(uuid, text)
  to service_role;
