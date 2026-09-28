-- Migratie 020: een paar foto's van de fotograaf ook delen met avondgasten.
-- Run ONCE in de Supabase SQL Editor (na 019).
--
-- Naast zichtbaar_dag (alleen daggasten) komt zichtbaar_avond: zo'n foto is
-- zichtbaar voor IEDERE ingelogde gast, dus ook avondgasten (en gasten zonder
-- dagdeel). Daggasten zien daarmee vrijgegeven dag- én avondfoto's.

alter table public.photos add column if not exists zichtbaar_avond boolean not null default false;

-- ============================================================
-- photos: wie ziet wat (vervangt de policy uit 019)
-- ============================================================
drop policy if exists "Foto's bekijken" on public.photos;
create policy "Foto's bekijken" on public.photos
  for select
  using (
    bron = 'gast'
    or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
    or (zichtbaar_dag and (select public.mijn_dagdeel()) = 'dag')
    or (zichtbaar_avond and auth.uid() is not null)
  );

-- Eigen foto's aanpassen mag, maar niet vrijgeven (dat is beheer).
drop policy if exists "Foto's aanpassen" on public.photos;
create policy "Foto's aanpassen" on public.photos
  for update
  using (
    user_id = auth.uid()
    or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
  )
  with check (
    (user_id = auth.uid() and bron = 'gast' and not zichtbaar_dag and not zichtbaar_avond)
    or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
  );

-- ============================================================
-- storage: bestanden van gedeelde avondfoto's ook voor avondgasten
-- ============================================================
drop policy if exists "Foto-bestanden bekijken" on storage.objects;
create policy "Foto-bestanden bekijken" on storage.objects
  for select
  using (
    bucket_id = 'wedding-photos'
    and (
      name not like 'fotograaf/%'
      or (select public.current_role()) in ('admin', 'ceremony_master', 'fotograaf')
      or exists (
        select 1 from public.photos p
         where p.bron = 'fotograaf'
           and (
             (p.zichtbaar_dag and (select public.mijn_dagdeel()) = 'dag')
             or (p.zichtbaar_avond and auth.uid() is not null)
           )
           and name in (p.storage_path, p.origineel_pad, p.thumb_pad)
      )
    )
  );
