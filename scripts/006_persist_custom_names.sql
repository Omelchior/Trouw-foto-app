-- Migration 006: keep a guest's self-chosen name across logins.
-- Run ONCE in the Supabase SQL Editor (after 005).
--
-- Before: claim_guest_profile() overwrote `name` from the guests table on EVERY
-- login, so a guest who renamed themselves lost it the next time they signed in.
-- After: `name` is only set when the profile is first created; later logins keep
-- the user's name but still refresh role/label authoritatively from the list.

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
    -- name intentionally NOT overwritten: keep the user's chosen name.
    role  = excluded.role,
    label = excluded.label
  returning * into prof;

  update public.guests set claimed_user_id = v_uid where slug = p_slug;

  return prof;
end;
$$;

grant execute on function public.claim_guest_profile(text) to authenticated, anon;
