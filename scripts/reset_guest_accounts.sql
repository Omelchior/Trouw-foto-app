-- Opschonen: verwijder ALLE ingelogde gast-accounts voor een schone start.
-- Dit raakt NIET de gastenlijst zelf (tabel `guests`) -- alleen de aangemaakte
-- logins/profielen. Bij de bruiloft maakt elke gast z'n account vanzelf opnieuw
-- aan zodra hij/zij de naam kiest. Veilig om vaker te draaien.
--
-- Draai dit in de Supabase SQL Editor wanneer je test-data wilt wissen.

delete from auth.users where email like '%@gast.trouwfoto.nl';

-- Gevolg (automatisch via foreign keys):
--   * public.user_profiles  -> rijen verdwijnen (on delete cascade)
--   * public.guests.claimed_user_id -> weer NULL (on delete set null)
--   * public.photos.user_id -> NULL (on delete set null)
