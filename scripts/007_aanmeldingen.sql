-- Migration 007: aanmeldingen (aanwezigheid) + gastenlijst gelijk aan de Excel
-- Run ONCE in the Supabase SQL Editor (after 001-006).
--
-- Model:
--   guests.aangemeld  = staat deze gast op "aanwezig"?
--     * beheer (admin) en ceremoniemeesters kunnen dit voor iedereen zetten
--     * een gast kan het ALLEEN voor zichzelf zetten (via zet_mijn_aanmelding)
--   Weergavenaam-regel: komt een voornaam één keer voor -> alleen de voornaam;
--   anders voornaam + eerste letter van de achternaam (waar bekend).

-- ============================================================
-- 1. Kolommen
-- ============================================================
alter table public.guests
  add column if not exists aangemeld boolean not null default false;

alter table public.guests
  add column if not exists aangemeld_op timestamptz;

-- ============================================================
-- 2. Gast meldt zichzelf aan (of af).
--    SECURITY DEFINER, maar hard gebonden aan de eigen identiteit:
--    alleen de rij waarvan de slug gelijk is aan het e-mail-local-part
--    van de ingelogde gebruiker kan worden aangepast.
-- ============================================================
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
     set aangemeld    = p_aangemeld,
         aangemeld_op = case when p_aangemeld then now() else null end
   where slug = v_slug;

  if not found then
    raise exception 'Onbekende gast: %', v_slug;
  end if;
end;
$$;

revoke execute on function public.zet_mijn_aanmelding(boolean) from public, anon;
grant execute on function public.zet_mijn_aanmelding(boolean) to authenticated;

-- ============================================================
-- 3. Beheer (admin + ceremoniemeester) zet de aanmelding van iedereen.
--    Aparte RPC zodat ceremoniemeesters GEEN rollen/namen kunnen wijzigen
--    (de directe tabel-write policy blijft admin-only).
-- ============================================================
create or replace function public.zet_aanmelding_voor(p_slug text, p_aangemeld boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if public.current_role() not in ('admin', 'ceremony_master') then
    raise exception 'Alleen beheer of ceremoniemeesters';
  end if;

  update public.guests
     set aangemeld    = p_aangemeld,
         aangemeld_op = case when p_aangemeld then now() else null end
   where slug = p_slug;

  if not found then
    raise exception 'Onbekende gast: %', p_slug;
  end if;
end;
$$;

revoke execute on function public.zet_aanmelding_voor(text, boolean) from public, anon;
grant execute on function public.zet_aanmelding_voor(text, boolean) to authenticated;

-- ============================================================
-- 4. Namen gelijk aan de Excel-gastenlijst.
--    Voornaam uniek -> alleen voornaam; dubbel -> + initiaal achternaam.
--    Slugs blijven ongewijzigd (die zijn gekoppeld aan de login-accounts).
-- ============================================================
update public.guests set name = 'Eline K.'    where slug = 'eline-a';  -- Fam. Kieft
update public.guests set name = 'Eline'       where slug = 'eline-b';  -- Politie academie (achternaam onbekend)
update public.guests set name = 'Emiel H.'    where slug = 'emiel-a';  -- Hijink, werk
update public.guests set name = 'Emiel J.'    where slug = 'emiel-b';  -- Janson, Fam. Poppink
update public.guests set name = 'Erik M.'     where slug = 'erik-a';   -- Melchior, getuige
update public.guests set name = 'Erik'        where slug = 'erik-b';   -- Fam. Doorlag (achternaam onbekend)
update public.guests set name = 'Jasper G.'   where slug = 'jasper-a'; -- Goos
update public.guests set name = 'Jasper'      where slug = 'jasper-b'; -- Vrienden +1 (achternaam onbekend)
update public.guests set name = 'Maaike W.'   where slug = 'maaike-a'; -- Welter, T-huis
update public.guests set name = 'Maaike'      where slug = 'maaike-b'; -- Fam. Kieft (achternaam onbekend)
update public.guests set name = 'Peter de R.' where slug = 'peter-a';  -- de Reus, gezin
update public.guests set name = 'Peter'       where slug = 'peter-b';  -- Fam. Doorlag (achternaam onbekend)
update public.guests set name = 'Tim'         where slug = 'tim-a';    -- Fam. Doorlag (achternaam onbekend)
update public.guests set name = 'Tim H.'      where slug = 'tim-h';    -- Hartog, werk

-- Voornamen die (weer) uniek zijn: alleen de voornaam tonen.
update public.guests set name = 'Henk' where slug = 'henk-a';
update public.guests set name = 'Rik'  where slug = 'rik-a';

-- ============================================================
-- 5. Ontbrekende gasten toevoegen, vervallen gasten verwijderen.
-- ============================================================
insert into public.guests (slug, name, role, label, phone) values
  ('denis',  'Denis',  'guest', null, null),   -- Fam. Kieft
  ('jayson', 'Jayson', 'guest', null, null)    -- Werk
on conflict (slug) do nothing;

-- Alleen verwijderen zolang niemand er ooit mee heeft ingelogd.
delete from public.guests
 where slug in ('alexander', 'aron', 'henk-b', 'rik-b')
   and claimed_user_id is null;

-- ============================================================
-- 6. Badges (getuigen + babs) en telefoonnummers uit de Excel.
-- ============================================================
update public.guests set label = 'getuige' where slug in ('erik-a', 'heinnie', 'marit', 'ronald');
update public.guests set label = 'babs'    where slug = 'marieke';

update public.guests set phone = '06-42060557' where slug = 'anton';
update public.guests set phone = '06-48682714' where slug = 'charonne';
update public.guests set phone = '06-82054910' where slug = 'erik-a';
update public.guests set phone = '06-15326018' where slug = 'heinnie';
update public.guests set phone = '06-20207191' where slug = 'irma';
update public.guests set phone = '06-81195483' where slug = 'klaas';
update public.guests set phone = '06-30085514' where slug = 'margo';
update public.guests set phone = '06-52772491' where slug = 'marieke';
update public.guests set phone = '06-38589872' where slug = 'marit';
update public.guests set phone = '06-50917162' where slug = 'peter-a';
update public.guests set phone = '06-24127816' where slug = 'ronald';
update public.guests set phone = '06-29428907' where slug = 'sira';

-- ============================================================
-- 7. Bruidspaar, ceremoniemeesters en fotograaf staan uiteraard op aanwezig.
-- ============================================================
update public.guests
   set aangemeld = true, aangemeld_op = now()
 where slug in ('olaf', 'ester', 'anton', 'sira', 'fotograaf-x');
