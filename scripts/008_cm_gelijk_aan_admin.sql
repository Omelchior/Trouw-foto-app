-- Migration 008: ceremoniemeesters zien en kunnen hetzelfde als beheerders,
-- en de vragen-functie (Q&A) verdwijnt.
-- Run ONCE in the Supabase SQL Editor (after 001-007).

-- ============================================================
-- 1. Gastenlijst-beheer: ook voor ceremoniemeesters.
-- ============================================================
drop policy if exists "guests_admin_write" on public.guests;
create policy "guests_beheer_write" on public.guests for all
  using (public.current_role() in ('admin', 'ceremony_master'))
  with check (public.current_role() in ('admin', 'ceremony_master'));

-- ============================================================
-- 2. Profiel-updates door beheer: ook voor ceremoniemeesters.
-- ============================================================
drop policy if exists "profiles_admin_all" on public.user_profiles;
create policy "profiles_beheer_all" on public.user_profiles for update
  using (public.current_role() in ('admin', 'ceremony_master'))
  with check (public.current_role() in ('admin', 'ceremony_master'));

-- ============================================================
-- 3. Vragen (Q&A) helemaal weg.
--    LET OP: dit verwijdert ook alle al gestelde vragen definitief.
-- ============================================================
drop table if exists public.qa_questions;
