-- Add guest tracking columns to photos table
alter table public.photos
  add column if not exists guest_token text,
  add column if not exists challenge_id integer,
  add column if not exists in_fotoboek boolean default false;

-- Guest sessions table
create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  name text not null,
  is_privileged boolean default false,
  created_at timestamp with time zone default now()
);

-- RLS for guest_sessions
alter table public.guest_sessions enable row level security;

create policy "Anyone can create a session" on public.guest_sessions
  for insert with check (true);

create policy "Anyone can read sessions" on public.guest_sessions
  for select using (true);

create policy "Anyone can update sessions" on public.guest_sessions
  for update using (true);

-- Indexes
create index if not exists idx_guest_sessions_token on public.guest_sessions(token);
create index if not exists idx_photos_guest_token on public.photos(guest_token);
create index if not exists idx_photos_in_fotoboek on public.photos(in_fotoboek);
