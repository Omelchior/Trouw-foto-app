-- Migration 012: huidige (openstaande) foto-opdracht per gast
-- Run ONCE in de Supabase SQL Editor (na 001-011).
--
-- Naast de door beheer toegewezen `eerste_opdracht` (op guests) houden we nu
-- per ingelogde gast bij welke vervolg-opdracht hij zelf via
-- "Geef me een opdracht!" heeft gekozen. Zo blijft de opdracht vast staan
-- (ook na herladen of op een ander apparaat) tot hij is afgerond, en kan het
-- beheer live uitlezen wie welke opdracht nu open heeft staan.
--
-- user_profiles staat al in de realtime-publicatie (migratie 004), dus het
-- beheeroverzicht werkt automatisch live bij.

alter table public.user_profiles
  add column if not exists huidige_opdracht integer
  check (huidige_opdracht between 1 and 33);

-- Gast zet (of wist met null) zijn eigen huidige opdracht.
create or replace function public.zet_mijn_opdracht(p_id integer)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_id is not null and (p_id < 1 or p_id > 33) then
    raise exception 'Ongeldige opdracht: %', p_id;
  end if;

  update public.user_profiles
     set huidige_opdracht = p_id
   where user_id = auth.uid();
end;
$$;

grant execute on function public.zet_mijn_opdracht(integer) to authenticated, anon;
