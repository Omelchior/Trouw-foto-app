-- Migration 005: closed guest list + passwordless name login + beheer hardening
-- Run ONCE in the Supabase SQL Editor (after 001-004).
--
-- Prerequisites in the Supabase dashboard BEFORE this works end-to-end:
--   * Authentication > Providers > Email: turn OFF "Confirm email"
--     (guests log in via a synthetic email behind the scenes; there is no
--      real inbox to confirm, so confirmation must be disabled).
--   * Anonymous sign-ins may be turned OFF now -- the new flow does not use them.
--
-- Model:
--   role  = ACCESS level  (guest | vip | fotograaf | ceremony_master | admin)
--   label = cosmetic BADGE (bruid | bruidegom | ceremoniemeester | fotograaf | NULL)
-- A person logs in by picking their name; their role/label is assigned
-- authoritatively from the `guests` table -- never from the browser.

-- ============================================================
-- 1. Extend roles + add cosmetic label on user_profiles
-- ============================================================
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('guest','vip','fotograaf','ceremony_master','admin'));

alter table public.user_profiles
  add column if not exists label text;

-- ============================================================
-- 2. guests: the authoritative closed allowlist
-- ============================================================
create table if not exists public.guests (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,          -- stable key; maps to synthetic login email local-part
  name            text not null,                 -- display name shown in the picker
  phone           text,
  role            text not null default 'guest'
                    check (role in ('guest','vip','fotograaf','ceremony_master','admin')),
  label           text,
  claimed_user_id uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.guests enable row level security;

-- The picker needs to read the list publicly (name + slug + role + label).
drop policy if exists "guests_select_public" on public.guests;
create policy "guests_select_public" on public.guests for select using (true);

-- Only admins may modify the list from the app.
drop policy if exists "guests_admin_write" on public.guests;
create policy "guests_admin_write" on public.guests for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create index if not exists idx_guests_slug on public.guests(slug);

-- ============================================================
-- 3. Seed the guest list (idempotent: re-running updates names/roles)
-- ============================================================
insert into public.guests (slug, name, role, label, phone) values
  ('andre',       'André',       'guest',           null,             null),
  ('anton',       'Anton',       'ceremony_master', 'ceremoniemeester', null),
  ('bert-jan',    'Bert-jan',    'guest',           null,             null),
  ('bianca',      'Bianca',      'guest',           null,             null),
  ('carlo',       'Carlo',       'guest',           null,             null),
  ('charlotte',   'Charlotte',   'guest',           null,             null),
  ('charonne',    'Charonne',    'guest',           null,             null),
  ('coen',        'Coen',        'guest',           null,             null),
  ('dany',        'Dany',        'guest',           null,             null),
  ('debora',      'Debora',      'guest',           null,             null),
  ('dominique',   'Dominique',   'guest',           null,             null),
  ('edwin',       'Edwin',       'guest',           null,             null),
  ('emiel-a',     'Emiel A.',    'guest',           null,             null),
  ('erik-a',      'Erik A.',     'guest',           null,             null),
  ('ester',       'Ester',       'admin',           'bruid',          null),
  ('heinnie',     'Heinnie',     'guest',           null,             null),
  ('hieke',       'Hieke',       'guest',           null,             null),
  ('hiltje',      'Hiltje',      'guest',           null,             null),
  ('imre',        'Imre',        'guest',           null,             null),
  ('irma',        'Irma',        'guest',           null,             null),
  ('jasper-a',    'Jasper A.',   'guest',           null,             null),
  ('jasper-b',    'Jasper B.',   'guest',           null,             null),
  ('jorinda',     'Jorinda',     'guest',           null,             null),
  ('kasper',      'Kasper',      'guest',           null,             null),
  ('klaas',       'Klaas',       'guest',           null,             null),
  ('maaike-a',    'Maaike A.',   'guest',           null,             null),
  ('maikel',      'Maikel',      'guest',           null,             null),
  ('manon',       'Manon',       'guest',           null,             null),
  ('margo',       'Margo',       'guest',           null,             null),
  ('marieke',     'Marieke',     'guest',           null,             null),
  ('marit',       'Marit',       'guest',           null,             null),
  ('maronne',     'Maronne',     'guest',           null,             null),
  ('max',         'Max',         'guest',           null,             null),
  ('olaf',        'Olaf',        'admin',           'bruidegom',      '0631642888'),
  ('oma',         'Oma',         'guest',           null,             null),
  ('peter-a',     'Peter A.',    'guest',           null,             null),
  ('richelle',    'Richelle',    'guest',           null,             null),
  ('ronald',      'Ronald',      'guest',           null,             null),
  ('sandra',      'Sandra',      'guest',           null,             null),
  ('sira',        'Sira',        'ceremony_master', 'ceremoniemeester', null),
  ('thomas',      'Thomas',      'guest',           null,             null),
  ('wopke',       'Wopke',       'guest',           null,             null),
  ('alexander',   'Alexander',   'guest',           null,             null),
  ('angelique',   'Angelique',   'guest',           null,             null),
  ('anne',        'Anne',        'guest',           null,             null),
  ('anneke',      'Anneke',      'guest',           null,             null),
  ('annemiek',    'Annemiek',    'guest',           null,             null),
  ('bernard',     'Bernard',     'guest',           null,             null),
  ('corrie',      'Corrie',      'guest',           null,             null),
  ('dennis',      'Dennis',      'guest',           null,             null),
  ('desiree',     'Desiree',     'guest',           null,             null),
  ('django',      'Django',      'guest',           null,             null),
  ('djim',        'Djim',        'guest',           null,             null),
  ('eline-a',     'Eline A.',    'guest',           null,             null),
  ('eline-b',     'Eline B.',    'guest',           null,             null),
  ('erik-b',      'Erik B.',     'guest',           null,             null),
  ('geert',       'Geert',       'guest',           null,             null),
  ('gizem',       'Gizem',       'guest',           null,             null),
  ('harmen',      'Harmen',      'guest',           null,             null),
  ('henk-a',      'Henk A.',     'guest',           null,             null),
  ('henk-b',      'Henk B.',     'guest',           null,             null),
  ('jaap',        'Jaap',        'guest',           null,             null),
  ('jannie',      'Jannie',      'guest',           null,             null),
  ('jeff',        'Jeff',        'guest',           null,             null),
  ('johan',       'Johan',       'guest',           null,             null),
  ('joke',        'Joke',        'guest',           null,             null),
  ('jordy',       'Jordy',       'guest',           null,             null),
  ('julia',       'Julia',       'guest',           null,             null),
  ('jurrian',     'Jurrian',     'guest',           null,             null),
  ('kees',        'Kees',        'guest',           null,             null),
  ('kirsten',     'Kirsten',     'guest',           null,             null),
  ('linde',       'Linde',       'guest',           null,             null),
  ('maaike-b',    'Maaike B.',   'guest',           null,             null),
  ('maarten',     'Maarten',     'guest',           null,             null),
  ('marlijn',     'Marlijn',     'guest',           null,             null),
  ('meike',       'Meike',       'guest',           null,             null),
  ('myron',       'Myron',       'guest',           null,             null),
  ('myrza',       'Myrza',       'guest',           null,             null),
  ('paulien',     'Paulien',     'guest',           null,             null),
  ('peter-b',     'Peter B.',    'guest',           null,             null),
  ('pien',        'Pien',        'guest',           null,             null),
  ('rik-a',       'Rik A.',      'guest',           null,             null),
  ('rik-b',       'Rik B.',      'guest',           null,             null),
  ('ruben',       'Ruben',       'guest',           null,             null),
  ('sanne',       'Sanne',       'guest',           null,             null),
  ('sebastiaan',  'Sebastiaan',  'guest',           null,             null),
  ('tim-a',       'Tim A.',      'guest',           null,             null),
  ('tim-h',       'Tim H.',      'admin',           null,             null),
  ('valerie',     'Valerie',     'guest',           null,             null),
  ('wietse',      'Wietse',      'guest',           null,             null),
  ('wim',         'Wim',         'guest',           null,             null),
  ('yliana',      'Yliana',      'guest',           null,             null),
  ('yves',        'Yves',        'guest',           null,             null),
  ('amy',         'Amy',         'guest',           null,             null),
  ('aron',        'Aron',        'guest',           null,             null),
  ('bene',        'Bene',        'guest',           null,             null),
  ('bram',        'Bram',        'guest',           null,             null),
  ('britt',       'Britt',       'guest',           null,             null),
  ('emiel-b',     'Emiel B.',    'guest',           null,             null),
  ('emma',        'Emma',        'guest',           null,             null),
  ('janine',      'Janine',      'guest',           null,             null),
  ('jochem',      'Jochem',      'guest',           null,             null),
  ('jurrie',      'Jurrie',      'guest',           null,             null),
  ('laura',       'Laura',       'guest',           null,             null),
  ('marlou',      'Marlou',      'guest',           null,             null),
  ('sabine',      'Sabine',      'guest',           null,             null),
  ('sjaan',       'Sjaan',       'guest',           null,             null),
  ('sytse',       'Sytse',       'guest',           null,             null),
  ('vivianne',    'Vivianne',    'guest',           null,             null),
  ('fotograaf-x', 'X',           'fotograaf',       'fotograaf',      null)
on conflict (slug) do update set
  name  = excluded.name,
  role  = excluded.role,
  label = excluded.label,
  phone = excluded.phone;

-- ============================================================
-- 4. claim_guest_profile: bind the just-signed-in synthetic user to its
--    guest row and copy the AUTHORITATIVE role/label/name into user_profiles.
--    SECURITY DEFINER so it can write the role the client is NOT allowed to set.
--    The email local-part must equal the slug, so a user signed in as
--    "jasper-a@..." can only ever claim the 'jasper-a' guest -- not someone else's.
-- ============================================================
create or replace function public.claim_guest_profile(p_slug text)
returns public.user_profiles
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  g       public.guests%rowtype;
  prof    public.user_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select * into g from public.guests where slug = p_slug;
  if not found then
    raise exception 'Onbekende gast: %', p_slug;
  end if;

  -- Bind the auth identity to exactly this guest (anti-impersonation of roles).
  if split_part(coalesce(v_email,''), '@', 1) <> p_slug then
    raise exception 'E-mail hoort niet bij deze gast';
  end if;

  insert into public.user_profiles (user_id, name, role, label, email)
  values (v_uid, g.name, g.role, g.label, v_email)
  on conflict (user_id) do update set
    name  = excluded.name,
    role  = excluded.role,
    label = excluded.label
  returning * into prof;

  update public.guests set claimed_user_id = v_uid where slug = p_slug;

  return prof;
end;
$$;

grant execute on function public.claim_guest_profile(text) to authenticated, anon;

-- ============================================================
-- 5. update_my_name: lets a user change ONLY their display name (not role).
-- ============================================================
create or replace function public.update_my_name(p_name text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  update public.user_profiles set name = trim(p_name) where user_id = auth.uid();
end;
$$;

grant execute on function public.update_my_name(text) to authenticated;

-- ============================================================
-- 6. Lock down direct writes to user_profiles.
--    Role/label/name now flow through the SECURITY DEFINER functions above,
--    so the browser can no longer self-assign a role.
-- ============================================================
drop policy if exists "profiles_insert_self" on public.user_profiles;
drop policy if exists "profiles_update_self" on public.user_profiles;
-- "profiles_read_public" (select) and "profiles_admin_all" (admin update) stay.

-- ============================================================
-- 7. Realtime for the guest list (so a newly added guest shows up live)
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'guests') then
    alter publication supabase_realtime add table public.guests;
  end if;
end $$;
