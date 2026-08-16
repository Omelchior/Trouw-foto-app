-- Migratie 016: handmatige aan/uit-schakelaar voor de app.
-- Run ONCE in de Supabase SQL Editor (na 001-015).
--
-- Eén rij (id = 1) met de open-modus:
--   'auto'  -> volgt de tijd (app opent vanzelf om 20:30 op de trouwdag)
--   'open'  -> nu geforceerd open voor alle gasten (noodschakelaar / eerder starten)
--   'dicht' -> geforceerd gesloten, ook na de trouwdag (uit-knop)
--
-- De middleware leest deze modus en overrulet daarmee de tijd-gate. Alleen
-- beheer en ceremoniemeesters mogen de modus aanpassen; iedereen mag hem lezen
-- (nodig voor de middleware en de homepage).

create table if not exists public.app_status (
  id            int primary key default 1 check (id = 1),
  open_modus    text not null default 'auto' check (open_modus in ('auto', 'open', 'dicht')),
  bijgewerkt_op timestamptz not null default now()
);

insert into public.app_status (id, open_modus) values (1, 'auto')
on conflict (id) do nothing;

alter table public.app_status enable row level security;

-- Iedereen mag de status lezen.
drop policy if exists "app_status_select_public" on public.app_status;
create policy "app_status_select_public" on public.app_status
  for select using (true);

-- Alleen beheer/ceremoniemeester mag de status aanpassen.
drop policy if exists "app_status_beheer_update" on public.app_status;
create policy "app_status_beheer_update" on public.app_status
  for update
  using (public.current_role() in ('admin', 'ceremony_master'))
  with check (public.current_role() in ('admin', 'ceremony_master'));

-- Realtime, zodat de schakelaar-status en de app-toegang live bijwerken.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_status'
  ) then
    alter publication supabase_realtime add table public.app_status;
  end if;
end $$;
