-- Supabase schema for Familia Uzcátegui Mora
-- Apply in Supabase SQL Editor.

-- Extensions
create extension if not exists pgcrypto;

-- Profiles (admin flag)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own"
on public.profiles for select
using (auth.uid() = id);

-- Allow each user to create their own profile row (used on first signup)
create policy "profiles: insert own"
on public.profiles for insert
with check (auth.uid() = id);

-- Allow each user to update their own profile row (optional)
create policy "profiles: update own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Auto-create profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false)
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin helper
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((
    select p.is_admin
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

-- Requests table (public can insert; only admin can view/approve)
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  requester_name text not null,
  type text not null check (type in ('add_person','edit_person')),
  notes text,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved'))
);

alter table public.requests enable row level security;

-- Anyone (anon) can insert a request
create policy "requests: insert public"
on public.requests for insert
with check (true);

-- Only admin can view requests
drop policy if exists "requests: select admin" on public.requests;

-- Everyone can view the list of requests (no sensitive data should go in payload/notes)
create policy "requests: select public"
on public.requests for select
using (true);

-- Only admin can update/delete requests
create policy "requests: update admin"
on public.requests for update
using (public.is_admin())
with check (public.is_admin());

create policy "requests: delete admin"
on public.requests for delete
using (public.is_admin());

-- People (tree data) - read public, write admin
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_date date,
  is_alive boolean not null default true,
  death_date date,
  location text,
  email text,
  instagram text,
  cover_photo_url text,
  created_at timestamptz not null default now()
);

alter table public.people enable row level security;

create policy "people: select public"
on public.people for select
using (true);

create policy "people: write admin"
on public.people for all
using (public.is_admin())
with check (public.is_admin());

-- Parent-child links (optional; will be used when loading real tree)
create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  parent_person_id uuid references public.people(id) on delete cascade,
  child_person_id uuid references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (parent_person_id, child_person_id)
);

alter table public.relationships enable row level security;

create policy "relationships: select public"
on public.relationships for select
using (true);

create policy "relationships: write admin"
on public.relationships for all
using (public.is_admin())
with check (public.is_admin());

-- Photos (URLs)
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  url text not null,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

create policy "photos: select public"
on public.photos for select
using (true);

create policy "photos: write admin"
on public.photos for all
using (public.is_admin())
with check (public.is_admin());

-- Admin approval RPC: marks request approved and (for now) just deletes it from the pending list.
-- Later we can expand to apply payload into people/relationships/photos.
create or replace function public.approve_request(req_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.requests
  set status = 'approved'
  where id = req_id and status = 'pending';

  -- Remove from list after approval (as requested)
  delete from public.requests
  where id = req_id and status = 'approved';
end;
$$;

grant execute on function public.approve_request(uuid) to authenticated;

