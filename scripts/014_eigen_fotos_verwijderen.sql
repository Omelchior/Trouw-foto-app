-- Migration 014: gasten verwijderen alleen hun EIGEN foto's
-- Run ONCE in de Supabase SQL Editor (na 001-013).
--
-- Voorheen mocht elke ingelogde gebruiker elke foto verwijderen (zowel de
-- database-rij als het storage-bestand). Nu geldt: een gast verwijdert alleen
-- foto's die hij zelf heeft geüpload; beheer en ceremoniemeesters mogen alles.
--
-- Voor storage gebruiken we de `owner`-kolom, die Supabase automatisch op de
-- uploader (auth.uid) zet bij een geauthenticeerde upload.

-- ============================================================
-- 1. photos-tabel: eigen rijen of beheer
-- ============================================================
drop policy if exists "Authenticated users can delete photos" on public.photos;
create policy "Eigen foto of beheer verwijdert" on public.photos
  for delete
  using (
    user_id = auth.uid()
    or public.current_role() in ('admin', 'ceremony_master')
  );

-- ============================================================
-- 2. storage: eigen bestanden of beheer
-- ============================================================
drop policy if exists "Authenticated can delete photos" on storage.objects;
create policy "Eigen foto of beheer verwijdert storage" on storage.objects
  for delete
  using (
    bucket_id = 'wedding-photos'
    and (
      owner = auth.uid()
      or public.current_role() in ('admin', 'ceremony_master')
    )
  );
