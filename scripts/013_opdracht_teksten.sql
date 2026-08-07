-- Migration 013: bewerkbare opdracht-teksten
-- Run ONCE in de Supabase SQL Editor (na 001-012).
--
-- De opdracht-teksten stonden hardcoded in de app. Ze komen nu uit deze tabel,
-- zodat beheer/ceremoniemeesters ze kunnen aanpassen via de beheerpagina. De
-- id's (en dus de koppeling met eerste_opdracht/huidige_opdracht/challenge_id)
-- blijven ongewijzigd 1..33; alleen de tekst is bewerkbaar.

create table if not exists public.opdracht_teksten (
  id             integer primary key,
  tekst          text not null,
  bijgewerkt_op  timestamptz not null default now()
);

alter table public.opdracht_teksten enable row level security;

-- Iedereen (ook gasten) mag de teksten lezen.
drop policy if exists "opdracht_teksten_read" on public.opdracht_teksten;
create policy "opdracht_teksten_read" on public.opdracht_teksten for select
  using (true);

-- Alleen beheer en ceremoniemeesters mogen teksten aanpassen.
drop policy if exists "opdracht_teksten_beheer" on public.opdracht_teksten;
create policy "opdracht_teksten_beheer" on public.opdracht_teksten for all
  using (public.current_role() in ('admin', 'ceremony_master'))
  with check (public.current_role() in ('admin', 'ceremony_master'));

-- Beginteksten (gelijk aan de hardcoded lijst). Bestaande teksten blijven staan.
insert into public.opdracht_teksten (id, tekst) values
  (1,  'Selfie met het bruidspaar'),
  (2,  'Groepsfoto met minimaal 2 mensen die je vandaag voor het eerst hebt ontmoet'),
  (3,  'Duo-foto met iemand uit een andere leeftijdsgroep (>20 jaar verschil)'),
  (4,  'Foto met iemand die dezelfde schoenmaat heeft'),
  (5,  'Foto met de DJ van de avond'),
  (6,  'Jij + iemand van de familie van de bruid + iemand van de familie van de bruidegom'),
  (7,  'Foto met iemand die dezelfde kleur draagt als jij'),
  (8,  'Foto waarop je met 5+ anderen proost'),
  (9,  'Foto met iemand wiens naam met dezelfde letter begint als die van jou'),
  (10, 'Foto met iemand die in een andere provincie woont dan jij'),
  (11, 'Duo-foto waarin jullie hetzelfde gebaar maken'),
  (12, 'Foto met iemand waarop jullie het bruidspaar nadoen'),
  (13, 'Foto met een stel (anders dan het bruidspaar)'),
  (14, 'Foto met iemand die een biertje drinkt én iemand die een wijntje drinkt'),
  (15, 'Foto met iemand ouder dan de bruid + iemand jonger dan de bruidegom'),
  (16, 'Foto met de langste of kortste persoon van het feest'),
  (17, 'Foto met iemand die een stropdas draagt'),
  (18, 'Foto met iemand die een snor heeft'),
  (19, 'Foto met iemand voor de bar'),
  (20, 'Foto met iemand van het personeel van de trouwlocatie'),
  (21, 'Foto samen met één van de ceremoniemeesters'),
  (22, 'Foto met iemand die een ander kledingstuk draagt dan jij'),
  (23, 'Foto met iemand die lekker aan het dansen is'),
  (24, 'Foto (samen met iemand anders) waarop iets roods te zien is'),
  (25, 'Foto (samen met iemand anders) waarop iets gouds te zien is'),
  (26, 'Foto vanuit kikkerperspectief, met zoveel mogelijk mensen erop'),
  (27, 'Foto samen met anderen waarop jullie samen één hart uitbeelden'),
  (28, 'Foto van mensen die hun handen in de lucht hebben tijdens het dansen'),
  (29, 'Foto met iemand die in dezelfde maand jarig is als jij'),
  (30, 'Foto samen met iemand waarop jullie in de lucht springen'),
  (31, 'Foto met iemand die dezelfde haarkleur heeft (of, net als jij, geen haar)'),
  (32, 'Foto samen met 2 anderen waarop jullie een gekke bek trekken'),
  (33, 'Foto samen met 5 mensen van het andere geslacht')
on conflict (id) do nothing;

-- Realtime zodat wijzigingen live doorkomen bij gasten en beheer.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'opdracht_teksten'
  ) then
    alter publication supabase_realtime add table public.opdracht_teksten;
  end if;
end $$;
