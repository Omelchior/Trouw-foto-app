-- Migration 011: foto-opdrachten uitgebreid naar 33
-- Run ONCE in de Supabase SQL Editor (na 001-010).
--
-- De check op `eerste_opdracht` stond op 1..25 (migratie 009). De
-- opdrachtenlijst (lib/guest.ts) telt nu 33 opdrachten, dus de check
-- moet mee verruimd worden zodat gasten aan opdracht 26-33 gekoppeld
-- kunnen worden.

alter table public.guests drop constraint if exists guests_eerste_opdracht_check;
alter table public.guests add constraint guests_eerste_opdracht_check
  check (eerste_opdracht between 1 and 33);
