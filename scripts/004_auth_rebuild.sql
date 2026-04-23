-- Migration: auth rebuild + RSVP + Q&A + bingo
-- Run this once in Supabase SQL Editor.
-- Pre-requisite: enable "Anonymous sign-ins" in Authentication > Providers.

-- ============================================================
-- 1. user_profiles: central identity + role
-- ============================================================
create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'guest' check (role in ('guest','vip','ceremony_master','admin')),
  email text,
  completed_challenges integer[] not null default array[]::integer[],
  created_at timestamptz not null default now()
);

alter table user_profiles enable row level security;

drop policy if exists "profiles_read_public" on user_profiles;
create policy "profiles_read_public" on user_profiles for select using (true);

drop policy if exists "profiles_insert_self" on user_profiles;
create policy "profiles_insert_self" on user_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_self" on user_profiles;
create policy "profiles_update_self" on user_profiles for update
  using (auth.uid() = user_id);

drop policy if exists "profiles_admin_all" on user_profiles;
create policy "profiles_admin_all" on user_profiles for update
  using (exists (select 1 from user_profiles p where p.user_id = auth.uid() and p.role = 'admin'));

-- Helper: fetch current user's role as text (defaults to 'guest')
create or replace function public.current_role() returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from user_profiles where user_id = auth.uid()), 'guest')
$$;

-- ============================================================
-- 2. RSVP
-- ============================================================
create table if not exists rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  email text not null,
  attending boolean not null,
  party_size integer not null default 1 check (party_size > 0),
  created_at timestamptz not null default now()
);

alter table rsvp_responses enable row level security;

drop policy if exists "rsvp_insert_public" on rsvp_responses;
create policy "rsvp_insert_public" on rsvp_responses for insert with check (true);

drop policy if exists "rsvp_select_admin" on rsvp_responses;
create policy "rsvp_select_admin" on rsvp_responses for select
  using (public.current_role() = 'admin');

drop policy if exists "rsvp_delete_admin" on rsvp_responses;
create policy "rsvp_delete_admin" on rsvp_responses for delete
  using (public.current_role() = 'admin');

-- ============================================================
-- 3. Q&A
-- ============================================================
create table if not exists qa_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guest_name text not null,
  question text not null,
  is_secret boolean not null default false,
  answer text,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table qa_questions enable row level security;

-- Any authenticated user (including anonymous guests) may ask
drop policy if exists "qa_insert_authenticated" on qa_questions;
create policy "qa_insert_authenticated" on qa_questions for insert
  with check (auth.uid() = user_id);

-- Public questions visible to everyone
drop policy if exists "qa_select_public" on qa_questions;
create policy "qa_select_public" on qa_questions for select
  using (is_secret = false);

-- Secret questions only visible to CM + admin
drop policy if exists "qa_select_secret_cm" on qa_questions;
create policy "qa_select_secret_cm" on qa_questions for select
  using (is_secret = true and public.current_role() in ('ceremony_master','admin'));

-- Only CM + admin may update (to post an answer)
drop policy if exists "qa_update_cm_admin" on qa_questions;
create policy "qa_update_cm_admin" on qa_questions for update
  using (public.current_role() in ('ceremony_master','admin'));

-- Only admin may delete
drop policy if exists "qa_delete_admin" on qa_questions;
create policy "qa_delete_admin" on qa_questions for delete
  using (public.current_role() = 'admin');

-- ============================================================
-- 4. Photos: link to auth.users
-- ============================================================
alter table photos add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists idx_photos_user_id on photos(user_id);

-- ============================================================
-- 5. RPC: mark challenge completed (idempotent, race-safe)
-- ============================================================
create or replace function public.mark_challenge_completed(p_challenge_id integer)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  update user_profiles
  set completed_challenges = (
    select array_agg(distinct x order by x)
    from unnest(array_append(completed_challenges, p_challenge_id)) as x
  )
  where user_id = auth.uid();
end;
$$;

grant execute on function public.mark_challenge_completed(integer) to authenticated, anon;

-- ============================================================
-- 6. Realtime publication (Supabase needs tables explicitly added for live updates)
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'qa_questions') then
    alter publication supabase_realtime add table qa_questions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'user_profiles') then
    alter publication supabase_realtime add table user_profiles;
  end if;
end $$;
