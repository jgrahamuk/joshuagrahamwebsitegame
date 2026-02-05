-- Supabase Migration: Multi-user maps
-- Run this in the Supabase SQL Editor to set up the database schema.

-- Profiles table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call handle_new_user on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Maps table
create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null default 'Untitled Map',
  description text not null default '',
  map_data jsonb not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookups by owner
create index if not exists maps_owner_id_idx on public.maps(owner_id);
-- Index for listing public maps
create index if not exists maps_is_public_idx on public.maps(is_public) where is_public = true;

-- Auto-update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists maps_updated_at on public.maps;
create trigger maps_updated_at
  before update on public.maps
  for each row execute function public.update_updated_at();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.maps enable row level security;

-- Profiles policies
create policy "Users can view all profiles"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Maps policies
create policy "Anyone can view public maps"
  on public.maps for select
  using (is_public = true or auth.uid() = owner_id);

create policy "Authenticated users can create maps"
  on public.maps for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their maps"
  on public.maps for update
  using (auth.uid() = owner_id);

create policy "Owners can delete their maps"
  on public.maps for delete
  using (auth.uid() = owner_id);
