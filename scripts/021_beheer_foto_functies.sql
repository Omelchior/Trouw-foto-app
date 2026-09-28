-- Migratie 021: beheer past foto's aan via functies i.p.v. directe updates.
-- Run ONCE in de Supabase SQL Editor (na 020).
--
-- Probleem: vrijgeven voor dag/avond en het vastleggen van thumbnails werden
-- door de database stil genegeerd (0 rijen aangepast, geen foutmelding). Deze
-- functies controleren zelf de rol en passen dan de foto's aan, los van de
-- RLS-regels op de tabel. Heb je geen beheerrechten, dan krijg je een duidelijke
-- fout mét je rol, zodat meteen zichtbaar is wat er mis is.

-- ============================================================
-- Fotograaf-foto's vrijgeven (null = die vlag niet aanpassen)
-- ============================================================
create or replace function public.beheer_zet_foto_zichtbaar(
  p_ids uuid[],
  p_dag boolean default null,
  p_avond boolean default null
) returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_rol text := public.current_role();
  v_aantal integer;
begin
  if v_rol not in ('admin', 'ceremony_master', 'fotograaf') then
    raise exception 'Geen beheerrechten om foto''s vrij te geven (jouw rol: %)', v_rol;
  end if;

  update public.photos
     set zichtbaar_dag   = coalesce(p_dag, zichtbaar_dag),
         zichtbaar_avond = coalesce(p_avond, zichtbaar_avond)
   where id = any(p_ids)
     and bron = 'fotograaf';
  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke execute on function public.beheer_zet_foto_zichtbaar(uuid[], boolean, boolean) from public, anon;
grant execute on function public.beheer_zet_foto_zichtbaar(uuid[], boolean, boolean) to authenticated;

-- ============================================================
-- Thumbnail vastleggen bij een bestaande foto
-- ============================================================
create or replace function public.beheer_zet_thumb(p_id uuid, p_pad text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_rol text := public.current_role();
begin
  if v_rol not in ('admin', 'ceremony_master', 'fotograaf') then
    raise exception 'Geen beheerrechten om thumbnails te maken (jouw rol: %)', v_rol;
  end if;
  if p_pad not like 'thumb/%' then
    raise exception 'Ongeldig thumbnail-pad: %', p_pad;
  end if;
  update public.photos set thumb_pad = p_pad where id = p_id;
  if not found then
    raise exception 'Foto % niet gevonden', p_id;
  end if;
end;
$$;

revoke execute on function public.beheer_zet_thumb(uuid, text) from public, anon;
grant execute on function public.beheer_zet_thumb(uuid, text) to authenticated;

-- ============================================================
-- Selecteren voor de diavoorstelling (hartje in het beheer)
-- ============================================================
create or replace function public.beheer_zet_geselecteerd(p_ids uuid[], p_waarde boolean)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_rol text := public.current_role();
  v_aantal integer;
begin
  if v_rol not in ('admin', 'ceremony_master', 'fotograaf') then
    raise exception 'Geen beheerrechten om foto''s te selecteren (jouw rol: %)', v_rol;
  end if;
  update public.photos set is_selected = p_waarde where id = any(p_ids);
  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke execute on function public.beheer_zet_geselecteerd(uuid[], boolean) from public, anon;
grant execute on function public.beheer_zet_geselecteerd(uuid[], boolean) to authenticated;

-- ============================================================
-- Diagnose (optioneel): welke regels staan er op photos, en welke rol heb jij?
-- ============================================================
-- select policyname, cmd, permissive, qual, with_check from pg_policies where tablename = 'photos';
-- select name, role from public.user_profiles where role in ('admin', 'ceremony_master', 'fotograaf');
