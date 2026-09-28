-- Migratie 019: foto's van de fotograaf (alleen voor daggasten, na selectie).
-- Run ONCE in de Supabase SQL Editor (na 001-018).
--
-- Na de bruiloft uploadt het beheer de foto's van de fotograaf. Die zijn
-- standaard voor niemand behalve het beheer zichtbaar; in het beheer kies je
-- per foto of hij voor DAGgasten te zien (en te downloaden) is. Avondgasten
-- krijgen fotograaf-foto's nooit te zien — dat wordt hier in de database
-- afgedwongen (RLS), niet alleen in de app.
--
-- Nieuwe kolommen op photos:
--   bron            'gast' (alles wat gasten zelf uploaden) of 'fotograaf'
--   zichtbaar_dag   fotograaf-foto is vrijgegeven voor daggasten
--   origineel_pad   volle-resolutie bestand voor downloads (storage_path is de
--                   webversie voor weergave; null = storage_path is origineel)
--   thumb_pad       kleine versie voor de fotogrids (null = storage_path)
--   origineel_naam  bestandsnaam van de fotograaf (downloadnaam + dubbel-check)
--
-- Fotograaf-bestanden staan in storage onder de map 'fotograaf/'.

alter table public.photos add column if not exists bron text not null default 'gast';
alter table public.photos add column if not exists zichtbaar_dag boolean not null default false;
alter table public.photos add column if not exists origineel_pad text;
alter table public.photos add column if not exists thumb_pad text;
alter table public.photos add column if not exists origineel_naam text;

alter table public.photos drop constraint if exists photos_bron_check;
alter table public.photos
  add constraint photos_bron_check check (bron in ('gast', 'fotograaf'));

create index if not exists idx_photos_bron on public.photos(bron);

-- ============================================================
-- Helper: dagdeel ('dag' | 'avond' | null) van de ingelogde gast
-- ============================================================
create or replace function public.mijn_dagdeel() returns text
language sql stable security definer
set search_path = public
as $$
  select g.dagdeel
    from public.guests g
   where g.claimed_user_id = auth.uid()
      or g.slug = split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)
   order by (g.claimed_user_id = auth.uid()) desc nulls last
   limit 1
$$;

grant execute on function public.mijn_dagdeel() to authenticated, anon;

-- ============================================================
-- photos: wie ziet wat
-- ============================================================
-- Gastfoto's: iedereen (zoals voorheen).
-- Fotograaf-foto's: beheer, ceremoniemeesters en de fotograaf altijd; daggasten
-- alleen de vrijgegeven foto's; avondgasten (en gasten zonder dagdeel) nooit.
drop policy if exists "Anyone can view photos" on public.photos;
drop policy if exists "Foto's bekijken" on public.photos;
create policy "Foto's bekijken" on public.photos
  for select
  using (
    bron = 'gast'
    or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
    or (zichtbaar_dag and (select public.mijn_dagdeel()) = 'dag')
  );

-- Uploaden: iedereen mag gastfoto's toevoegen, alleen beheer fotograaf-foto's.
drop policy if exists "Anyone can upload photos" on public.photos;
drop policy if exists "Foto's uploaden" on public.photos;
create policy "Foto's uploaden" on public.photos
  for insert
  with check (
    bron = 'gast'
    or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
  );

-- Aanpassen: voorheen mocht elke ingelogde gebruiker elke foto aanpassen. Nu:
-- je eigen foto (fotoboek-hartje) of beheer (selectie / vrijgeven).
drop policy if exists "Authenticated users can update photos" on public.photos;
drop policy if exists "Foto's aanpassen" on public.photos;
create policy "Foto's aanpassen" on public.photos
  for update
  using (
    user_id = auth.uid()
    or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
  )
  with check (
    (user_id = auth.uid() and bron = 'gast' and not zichtbaar_dag)
    or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
  );

-- ============================================================
-- storage: fotograaf-bestanden alleen voor wie ze mag zien
-- ============================================================
-- Downloaden gaat via de storage-API (niet de publieke URL) en die volgt deze
-- policy. Zo kan een avondgast de map 'fotograaf/' ook niet opvragen of
-- doorzoeken.
drop policy if exists "Anyone can view photos" on storage.objects;
drop policy if exists "Foto-bestanden bekijken" on storage.objects;
create policy "Foto-bestanden bekijken" on storage.objects
  for select
  using (
    bucket_id = 'wedding-photos'
    and (
      name not like 'fotograaf/%'
      or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
      or (
        (select public.mijn_dagdeel()) = 'dag'
        and exists (
          select 1 from public.photos p
           where p.bron = 'fotograaf'
             and p.zichtbaar_dag
             and name in (p.storage_path, p.origineel_pad, p.thumb_pad)
        )
      )
    )
  );

-- ============================================================
-- Controle: gasten zonder dagdeel zien GEEN fotograaf-foto's.
-- Draai deze query en vul zo nodig dagdeel = 'dag' in bij wie het betreft.
-- ============================================================
-- select slug, name, role from public.guests where dagdeel is null order by name;
