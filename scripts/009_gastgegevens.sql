-- Migration 009: uitgebreide gastgegevens + draaiboek
-- Run ONCE in the Supabase SQL Editor (after 001-008).
--
-- * aanwezigheid vervangt de aangemeld-boolean:
--     'aangemeld' | 'afwezig' | 'waarschijnlijk' | 'onzeker'
--   Alleen 'aangemeld' geeft toegang tot de app op de trouwdag.
-- * Nieuwe gastvelden: groep, dagdeel (dag/avond), dieetwensen,
--   eerste_opdracht, opmerkingen, relatie, naamkaartje, tafel.
-- * beheer_teksten: vrije teksten voor het beheer (o.a. het draaiboek).
-- * Gastgegevens uit "Overzicht bruiloft.xlsx" (tab Gasten + Tafel indeling).

-- ============================================================
-- 1. Nieuwe kolommen
-- ============================================================
alter table public.guests add column if not exists aanwezigheid text not null default 'onzeker'
  check (aanwezigheid in ('aangemeld','afwezig','waarschijnlijk','onzeker'));
alter table public.guests add column if not exists groep text;
alter table public.guests add column if not exists dagdeel text
  check (dagdeel in ('dag','avond'));
alter table public.guests add column if not exists dieetwensen text;
alter table public.guests add column if not exists eerste_opdracht integer
  check (eerste_opdracht between 1 and 25);
alter table public.guests add column if not exists opmerkingen text;
alter table public.guests add column if not exists relatie text;
alter table public.guests add column if not exists naamkaartje text;
alter table public.guests add column if not exists tafel integer
  check (tafel between 1 and 5);

-- ============================================================
-- 2. Oude aangemeld-boolean overzetten en opruimen
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'guests'
               and column_name = 'aangemeld') then
    update public.guests set aanwezigheid = 'aangemeld' where aangemeld = true;
  end if;
end $$;

alter table public.guests drop column if exists aangemeld;
alter table public.guests drop column if exists aangemeld_op;

-- ============================================================
-- 3. RPC's op de nieuwe status
-- ============================================================
-- Gast meldt zichzelf aan of af (zelfde naam als voorheen, nieuwe kolom).
create or replace function public.zet_mijn_aanmelding(p_aangemeld boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_slug text := split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);
begin
  if auth.uid() is null or v_slug = '' then
    raise exception 'Niet ingelogd';
  end if;

  update public.guests
     set aanwezigheid = case when p_aangemeld then 'aangemeld' else 'afwezig' end
   where slug = v_slug;

  if not found then
    raise exception 'Onbekende gast: %', v_slug;
  end if;
end;
$$;

revoke execute on function public.zet_mijn_aanmelding(boolean) from public, anon;
grant execute on function public.zet_mijn_aanmelding(boolean) to authenticated;

-- Beheer/ceremoniemeester zet elke status voor elke gast.
create or replace function public.zet_aanwezigheid_voor(p_slug text, p_status text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if public.current_role() not in ('admin', 'ceremony_master') then
    raise exception 'Alleen beheer of ceremoniemeesters';
  end if;
  if p_status not in ('aangemeld','afwezig','waarschijnlijk','onzeker') then
    raise exception 'Ongeldige status: %', p_status;
  end if;

  update public.guests set aanwezigheid = p_status where slug = p_slug;

  if not found then
    raise exception 'Onbekende gast: %', p_slug;
  end if;
end;
$$;

revoke execute on function public.zet_aanwezigheid_voor(text, text) from public, anon;
grant execute on function public.zet_aanwezigheid_voor(text, text) to authenticated;

drop function if exists public.zet_aanmelding_voor(text, boolean);

-- ============================================================
-- 4. Draaiboek: vrije beheer-teksten (alleen admin + ceremoniemeester)
-- ============================================================
create table if not exists public.beheer_teksten (
  sleutel        text primary key,
  inhoud         text not null default '',
  bijgewerkt_op  timestamptz not null default now()
);

alter table public.beheer_teksten enable row level security;

drop policy if exists "beheer_teksten_beheer" on public.beheer_teksten;
create policy "beheer_teksten_beheer" on public.beheer_teksten for all
  using (public.current_role() in ('admin', 'ceremony_master'))
  with check (public.current_role() in ('admin', 'ceremony_master'));

insert into public.beheer_teksten (sleutel, inhoud)
values ('draaiboek', '')
on conflict (sleutel) do nothing;

-- ============================================================
-- 5. Naamcorrectie: de tweede Eline heet IJsselstein.
-- ============================================================
update public.guests set name = 'Eline IJ.' where slug = 'eline-b';

-- ============================================================
-- 6. Gastgegevens uit de Excel (tab "Gasten" + "Tafel indeling")
-- ============================================================
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Oom Olaf (Fam vader/Melchior)', opmerkingen = null, dieetwensen = null, tafel = 1 where slug = 'andre';
update public.guests set groep = 'Gezin', dagdeel = 'dag', relatie = 'Ceremoniemeester - Broer Olaf', opmerkingen = null, dieetwensen = null, tafel = 1 where slug = 'anton';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'dag', relatie = 'Peet-oom Ester', opmerkingen = null, dieetwensen = null, tafel = 1 where slug = 'bert-jan';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Tante Olaf - Partner Andre', opmerkingen = null, dieetwensen = null, tafel = 1 where slug = 'bianca';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'dag', relatie = 'Partner Jorinda', opmerkingen = null, dieetwensen = null, tafel = 1 where slug = 'carlo';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Nicht Olaf', opmerkingen = null, dieetwensen = null, tafel = 1 where slug = 'charlotte';
update public.guests set groep = 'Gezin', dagdeel = 'dag', relatie = 'Partner Erik', opmerkingen = null, dieetwensen = null, tafel = 1 where slug = 'charonne';
update public.guests set groep = 'Vrienden (+1)', dagdeel = 'dag', relatie = 'Partner Wopke', opmerkingen = null, dieetwensen = null, tafel = 1 where slug = 'coen';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'dag', relatie = 'Vriendin theehuis', opmerkingen = null, dieetwensen = 'Vega', tafel = 1, aanwezigheid = 'aangemeld' where slug = 'dany';
update public.guests set groep = 'Vrienden', dagdeel = 'dag', relatie = 'Vriendin middelbare school', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'debora';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Neef Olaf', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'dominique';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Oom Olaf (Fam vader/Melchior)', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'edwin';
update public.guests set groep = 'Werk', dagdeel = 'dag', relatie = 'Vriend&collega Olaf', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'emiel-a';
update public.guests set groep = 'Gezin', dagdeel = 'dag', relatie = 'Getuige Olaf - Broer Olaf', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'erik-a';
update public.guests set groep = 'Overige', dagdeel = 'dag', relatie = 'Bruid', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'ester';
update public.guests set groep = 'Gezin', dagdeel = 'dag', relatie = 'Getuige Ester - Moeder Ester', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'heinnie';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'dag', relatie = 'Nicht Ester (Fam moeder/Kieft)', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'hieke';
update public.guests set groep = 'Overige', dagdeel = 'dag', relatie = 'Vrieden van ouders Ester', opmerkingen = null, dieetwensen = null, tafel = 2 where slug = 'hiltje';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Partner oma Olaf', opmerkingen = null, dieetwensen = null, tafel = 3 where slug = 'imre';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'dag', relatie = 'Peet-tante Ester', opmerkingen = null, dieetwensen = null, tafel = 3 where slug = 'irma';
update public.guests set groep = 'Vrienden (+1)', dagdeel = 'dag', relatie = 'Partner Emiel', opmerkingen = null, dieetwensen = null, tafel = 3 where slug = 'janine';
update public.guests set groep = 'Vrienden', dagdeel = 'dag', relatie = 'Partner Marit', opmerkingen = null, dieetwensen = null, tafel = 3 where slug = 'jasper-a';
update public.guests set groep = 'Vrienden (+1)', dagdeel = 'dag', relatie = 'Partner Debora', opmerkingen = null, dieetwensen = null, tafel = 3 where slug = 'jasper-b';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'dag', relatie = 'Nichtje Ester (Fam vader/Doorlag)', opmerkingen = null, dieetwensen = null, tafel = 3 where slug = 'jorinda';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'dag', relatie = 'Partner Hieke', opmerkingen = null, dieetwensen = null, tafel = 3 where slug = 'kasper';
update public.guests set groep = 'Gezin', dagdeel = 'dag', relatie = 'Vader Ester', opmerkingen = null, dieetwensen = null, tafel = 3 where slug = 'klaas';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'dag', relatie = 'Vriendin theehuis', opmerkingen = null, dieetwensen = 'Vegan', tafel = 3, aanwezigheid = 'aangemeld' where slug = 'maaike-a';
update public.guests set groep = 'Vrienden', dagdeel = 'dag', relatie = 'Partner Sira', opmerkingen = null, dieetwensen = null, tafel = 4 where slug = 'maikel';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Partner Thomas', opmerkingen = null, dieetwensen = null, tafel = 4 where slug = 'manon';
update public.guests set groep = 'Gezin', dagdeel = 'dag', relatie = 'Moeder Olaf', opmerkingen = null, dieetwensen = null, tafel = 4 where slug = 'margo';
update public.guests set groep = 'Overige', dagdeel = 'dag', relatie = 'Babs - Vrienden van ouders Ester', opmerkingen = null, dieetwensen = null, tafel = 4 where slug = 'marieke';
update public.guests set groep = 'Vrienden', dagdeel = 'dag', relatie = 'Getuige Ester - Vriendin middelbare school', opmerkingen = null, dieetwensen = 'Zwanger', tafel = 4, aanwezigheid = 'aangemeld' where slug = 'marit';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'dag', relatie = 'Vriendin theehuis', opmerkingen = null, dieetwensen = 'Noten', tafel = 4, aanwezigheid = 'aangemeld' where slug = 'maronne';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Neef Olaf', opmerkingen = null, dieetwensen = null, tafel = 4 where slug = 'max';
update public.guests set groep = 'Overige', dagdeel = 'dag', relatie = 'Bruidegom', opmerkingen = null, dieetwensen = null, tafel = 4 where slug = 'olaf';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Oma Olaf', opmerkingen = null, dieetwensen = null, tafel = 5 where slug = 'oma';
update public.guests set groep = 'Gezin', dagdeel = 'dag', relatie = 'Partner moeder Olaf', opmerkingen = null, dieetwensen = null, tafel = 5 where slug = 'peter-a';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'dag', relatie = 'Vriendin theehuis', opmerkingen = null, dieetwensen = null, tafel = 5 where slug = 'richelle';
update public.guests set groep = 'Gezin', dagdeel = 'dag', relatie = 'Getuige Olaf - Vader Olaf', opmerkingen = null, dieetwensen = null, tafel = 5 where slug = 'ronald';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Tante Olaf - Partner Edwin', opmerkingen = null, dieetwensen = null, tafel = 5 where slug = 'sandra';
update public.guests set groep = 'Vrienden', dagdeel = 'dag', relatie = 'Ceremoniemeester - Vriendin middelbare school', opmerkingen = null, dieetwensen = 'Vega', tafel = 5, aanwezigheid = 'aangemeld' where slug = 'sira';
update public.guests set groep = 'Fam. Melchior', dagdeel = 'dag', relatie = 'Neef Olaf', opmerkingen = null, dieetwensen = null, tafel = 5 where slug = 'thomas';
update public.guests set groep = 'Vrienden', dagdeel = 'dag', relatie = 'Vriendin middelbare school', opmerkingen = null, dieetwensen = null, tafel = 5 where slug = 'wopke';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'angelique';
update public.guests set groep = 'Politie academie', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'anne';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'anneke';
update public.guests set groep = 'Werk', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'annemiek';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'bernard';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'corrie';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'denis';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'dennis';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'desiree';
update public.guests set groep = 'Vrienden (+1)', dagdeel = 'avond', relatie = 'Partner Yliana', opmerkingen = null, dieetwensen = null, tafel = null where slug = 'django';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'djim';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'eline-a';
update public.guests set groep = 'Politie academie', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'eline-b';
update public.guests set groep = 'Fam. Poppink', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'emiel-b';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = '+ partner?', dieetwensen = null, tafel = null where slug = 'erik-b';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = '+ TIM ?', dieetwensen = null, tafel = null where slug = 'geert';
update public.guests set groep = 'Politie academie', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'gizem';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'harmen';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'henk-a';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'jaap';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'jannie';
update public.guests set groep = 'Werk', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'jayson';
update public.guests set groep = 'Vrienden (+1)', dagdeel = 'avond', relatie = 'Partner Myrza', opmerkingen = null, dieetwensen = null, tafel = null where slug = 'jeff';
update public.guests set groep = 'Fam. Poppink', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'jochem';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'johan';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'joke';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'jordy';
update public.guests set groep = 'Vrienden (+1)', dagdeel = 'avond', relatie = 'Partner Maarten', opmerkingen = null, dieetwensen = null, tafel = null where slug = 'julia';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'jurrian';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'kees';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'kirsten';
update public.guests set groep = 'Fam. Poppink', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'laura';
update public.guests set groep = 'Politie academie', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'linde';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'maaike-b';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'maarten';
update public.guests set groep = 'Politie academie', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'marlijn';
update public.guests set groep = 'Fam. Poppink', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'marlou';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = '+ in overleg met erik', dieetwensen = null, tafel = null where slug = 'meike';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'myron';
update public.guests set groep = 'Vrienden (oud huisgenoot)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'myrza';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'paulien';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'peter-b';
update public.guests set groep = 'Politie academie', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'pien';
update public.guests set groep = 'Werk', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'rik-a';
update public.guests set groep = 'Vrienden (+1)', dagdeel = 'avond', relatie = 'Partner Valerie', opmerkingen = null, dieetwensen = null, tafel = null where slug = 'ruben';
update public.guests set groep = 'Fam. Poppink', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'sabine';
update public.guests set groep = 'Vrienden (oud huisgenoot)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'sanne';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'sebastiaan';
update public.guests set groep = 'Fam. Doorlag', dagdeel = 'avond', relatie = null, opmerkingen = '+ in overleg met geert', dieetwensen = null, tafel = null where slug = 'tim-a';
update public.guests set groep = 'Werk', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'tim-h';
update public.guests set groep = 'Vrienden (oud huisgenoot)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'valerie';
update public.guests set groep = 'Fam. Poppink', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'vivianne';
update public.guests set groep = 'Vrienden (+1)', dagdeel = 'avond', relatie = 'Partner Sanne', opmerkingen = null, dieetwensen = null, tafel = null where slug = 'wietse';
update public.guests set groep = 'Fam. Kieft', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'wim';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'yliana';
update public.guests set groep = 'Vrienden (T-huis)', dagdeel = 'avond', relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'yves';
update public.guests set groep = 'Fam. Poppink', dagdeel = null, relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'amy';
update public.guests set groep = 'Fam. Kieft', dagdeel = null, relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'bene';
update public.guests set groep = 'Fam. Doorlag', dagdeel = null, relatie = null, opmerkingen = '+ in overleg met  H&P', dieetwensen = null, tafel = null where slug = 'bram';
update public.guests set groep = 'Fam. Poppink', dagdeel = null, relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'britt';
update public.guests set groep = 'Fam. Doorlag', dagdeel = null, relatie = null, opmerkingen = '+ in overleg met  H&P', dieetwensen = null, tafel = null where slug = 'emma';
update public.guests set groep = 'Fam. Doorlag', dagdeel = null, relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'jurrie';
update public.guests set groep = 'Fam. Doorlag', dagdeel = null, relatie = null, opmerkingen = null, dieetwensen = null, tafel = null where slug = 'sjaan';
update public.guests set groep = 'Fam. Doorlag', dagdeel = null, relatie = null, opmerkingen = '+ in overleg met erik', dieetwensen = null, tafel = null where slug = 'sytse';
