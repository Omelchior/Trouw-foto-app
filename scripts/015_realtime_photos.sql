-- Migratie 015: realtime aanzetten voor de foto's.
-- Run ONCE in de Supabase SQL Editor (na 001-014).
--
-- Zonder deze regel ontvangt de "live" diavoorstelling (en de beheer-, selectie-
-- en opdracht-schermen) géén nieuwe foto's: het realtime-abonnement op de
-- photos-tabel verbindt wel, maar krijgt nooit events. Foto's verschenen dan
-- pas na een handmatige refresh. Dit voegt de tabel toe aan de realtime-
-- publicatie, zodat inserts/updates/deletes direct doorkomen.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photos'
  ) then
    alter publication supabase_realtime add table public.photos;
  end if;
end $$;
