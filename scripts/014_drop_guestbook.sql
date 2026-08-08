-- Gastenboek volledig verwijderd uit de app; de tabel (incl. de 2 testberichten,
-- policies en index) is niet langer nodig. Draai dit in de Supabase SQL-editor.
drop table if exists public.guestbook_entries cascade;
