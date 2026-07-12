import { createClient } from './supabase/client'

export const MAX_FOTOBOEK = 5
export const BINGO_SIZE = 5

// Behind-the-scenes login identity. Guests never see or type this — picking
// their name maps to <slug>@<domain> with a deterministic password, so the
// same guest always returns to the same account (also on another device).
const GUEST_EMAIL_DOMAIN = 'gast.trouwfoto.nl'
function guestEmail(slug: string): string {
  return `${slug}@${GUEST_EMAIL_DOMAIN}`
}
function guestPassword(slug: string): string {
  return `gast-${slug}-Trouw!2026`
}

export type Role = 'guest' | 'vip' | 'fotograaf' | 'ceremony_master' | 'admin'

export interface UserProfile {
  user_id: string
  name: string
  role: Role
  label: string | null
  email: string | null
  completed_challenges: number[]
}

export interface GuestSession extends UserProfile {
  token: string        // alias for user_id (backwards-compat)
  is_privileged: boolean
}

/** Aanwezigheidsstatus van een gast; alleen 'aangemeld' geeft toegang. */
export type Aanwezigheid = 'aangemeld' | 'afwezig' | 'waarschijnlijk' | 'onzeker'

export const AANWEZIGHEID_OPTIES: { value: Aanwezigheid; tekst: string }[] = [
  { value: 'aangemeld', tekst: 'Aangemeld' },
  { value: 'waarschijnlijk', tekst: 'Waarschijnlijk' },
  { value: 'onzeker', tekst: 'Nog onzeker' },
  { value: 'afwezig', tekst: 'Afwezig' },
]

/** A single entry in the public guest picker. */
export interface GuestListEntry {
  slug: string
  name: string
  label: string | null
  role: Role
  aanwezigheid: Aanwezigheid
}

export interface UploadCounts {
  uploaded: number
  fotoboek: number
}

export interface Challenge {
  id: number
  text: string
}

// 25 verbindings-opdrachten voor 5x5 bingo-kaart
export const CHALLENGES: Challenge[] = [
  { id: 1,  text: 'Selfie met het bruidspaar' },
  { id: 2,  text: 'Groepsfoto met 3 mensen die je vandaag voor het eerst ontmoet' },
  { id: 3,  text: 'Duo-foto met iemand uit een andere leeftijdsgroep (>20 jaar verschil)' },
  { id: 4,  text: 'Foto met iemand die dezelfde schoenenmaat heeft' },
  { id: 5,  text: 'Groepsfoto van mensen die >5 uur hebben gereisd' },
  { id: 6,  text: 'Trio: jij + iemand van de familie van de bruid + iemand van de bruidegom' },
  { id: 7,  text: 'Foto met iemand die dezelfde kleur draagt als jij' },
  { id: 8,  text: 'Groep van 5+ mensen die allemaal op één knie zitten' },
  { id: 9,  text: 'Foto met iemand wiens naam met dezelfde letter begint als die van jou' },
  { id: 10, text: 'Selfie met iemand die >100 km rijdt voor de bruiloft' },
  { id: 11, text: 'Duo-foto waarin jullie hetzelfde gebaar maken' },
  { id: 12, text: 'Foto met iemand die je al >10 jaar kent' },
  { id: 13, text: 'Groepsfoto met alle mensen aan je tafel' },
  { id: 14, text: 'Vraag een onbekende naar zijn favoriete herinnering aan het bruidspaar (foto erbij)' },
  { id: 15, text: 'Foto met iemand ouder dan de bruid + iemand jonger dan de bruidegom' },
  { id: 16, text: 'Twee gasten die elkaar een knuffel geven' },
  { id: 17, text: 'Foto waarin iedereen naar hetzelfde punt wijst' },
  { id: 18, text: 'Spiegel- of schaduwfoto met een andere gast' },
  { id: 19, text: 'Foto met iemand die de eerste dans van het bruidspaar kent' },
  { id: 20, text: 'Twee mensen die elkaar eerst niet kenden, nu samen lachen' },
  { id: 21, text: 'Vraag iemand om zijn favoriete eigenschap van de bruid/bruidegom (foto erbij)' },
  { id: 22, text: 'Groepsselfie: zo veel mogelijk mensen in één frame' },
  { id: 23, text: 'Foto met iemand die iets unieks aanheeft' },
  { id: 24, text: 'Duo van de jongste + oudste gast' },
  { id: 25, text: 'Foto met iemand die al heeft gedanst vanavond' },
]

export function getChallenge(id: number): Challenge | undefined {
  return CHALLENGES.find(c => c.id === id)
}

/** Beheer-capable roles (mogen het beheer in, achter het wachtwoord). */
export function isPrivilegedRole(role: Role): boolean {
  return role === 'ceremony_master' || role === 'admin'
}

/**
 * Fetch the public guest directory for the name picker.
 */
export async function getGuestList(): Promise<GuestListEntry[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('guests')
    .select('slug, name, label, role, aanwezigheid')
    .order('name')

  if (!error && data) return data as GuestListEntry[]

  // Fallback zolang migratie 009 (aanwezigheid-kolom) nog niet is uitgevoerd.
  const oud = await supabase
    .from('guests')
    .select('slug, name, label, role, aangemeld')
    .order('name')
  if (!oud.error && oud.data) {
    return oud.data.map((g: { aangemeld?: boolean } & Omit<GuestListEntry, 'aanwezigheid'>) => ({
      ...g,
      aanwezigheid: (g.aangemeld ? 'aangemeld' : 'onzeker') as Aanwezigheid,
    }))
  }

  const legacy = await supabase
    .from('guests')
    .select('slug, name, label, role')
    .order('name')
  if (legacy.error || !legacy.data) return []
  return legacy.data.map((g) => ({ ...g, aanwezigheid: 'aangemeld' as Aanwezigheid })) as GuestListEntry[]
}

/**
 * Aanwezigheidsstatus van de ingelogde gast.
 * Geeft null bij onbekend (geen gast-rij of migratie nog niet uitgevoerd);
 * behandel null als "aangemeld" zodat de app blijft werken.
 */
export async function getMijnAanwezigheid(): Promise<Aanwezigheid | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const slug = (user?.email ?? '').split('@')[0]
  if (!slug) return null

  const { data, error } = await supabase
    .from('guests')
    .select('aanwezigheid')
    .eq('slug', slug)
    .maybeSingle()

  if (!error && data) return (data as { aanwezigheid: Aanwezigheid }).aanwezigheid

  // Fallback op de oude boolean-kolom.
  const oud = await supabase
    .from('guests')
    .select('aangemeld')
    .eq('slug', slug)
    .maybeSingle()
  if (oud.error || !oud.data) return null
  return (oud.data as { aangemeld: boolean }).aangemeld ? 'aangemeld' : 'onzeker'
}

/** Gast meldt zichzelf aan (of af) voor de bruiloft. */
export async function zetMijnAanmelding(aangemeld: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('zet_mijn_aanmelding', { p_aangemeld: aangemeld })
  if (error) throw error
}

/** Beheer of ceremoniemeester zet de aanwezigheid van een willekeurige gast. */
export async function zetAanwezigheidVoor(slug: string, status: Aanwezigheid): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('zet_aanwezigheid_voor', {
    p_slug: slug,
    p_status: status,
  })
  if (error) throw error
}

/**
 * Get the currently authenticated user's profile.
 * Returns null if not logged in or profile row not found.
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, name, role, label, email, completed_challenges')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return data as UserProfile
}

/**
 * Backwards-compat: returns GuestSession shape from the profile.
 * Existing code uses `session.token` / `session.is_privileged`.
 */
export async function getGuestSession(): Promise<GuestSession | null> {
  const profile = await getCurrentProfile()
  if (!profile) return null
  return {
    ...profile,
    token: profile.user_id,
    is_privileged: isPrivilegedRole(profile.role),
  }
}

/**
 * Log in as a guest from the closed list, identified by their slug.
 * First login creates the behind-the-scenes account; later logins reuse it.
 * The role/label are assigned authoritatively server-side via claim_guest_profile.
 */
export async function loginAsGuest(slug: string): Promise<GuestSession> {
  const supabase = createClient()
  const email = guestEmail(slug)
  const password = guestPassword(slug)

  // Try to sign in; if the account does not exist yet, create it (first login).
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      // Possibly created concurrently from another device — try signing in once more.
      const retry = await supabase.auth.signInWithPassword({ email, password })
      if (retry.error) throw signUpError
    }
  }

  // Assign name/role/label from the authoritative guests table (security definer).
  const { error: claimError } = await supabase.rpc('claim_guest_profile', { p_slug: slug })
  if (claimError) throw claimError

  const session = await getGuestSession()
  if (!session) throw new Error('Profiel niet gevonden na inloggen')
  return session
}

/** Update the current user's display name (via RPC; direct writes are locked down). */
export async function updateProfileName(name: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('update_my_name', { p_name: name })
  if (error) throw error
}

/**
 * Upload photo counts for the current user.
 */
export async function getUploadCounts(userId: string): Promise<UploadCounts> {
  const supabase = createClient()

  const { count: uploaded } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: fotoboek } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('in_fotoboek', true)

  return {
    uploaded: uploaded || 0,
    fotoboek: fotoboek || 0,
  }
}

export async function markInFotoboek(photoId: string, value: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('photos')
    .update({ in_fotoboek: value })
    .eq('id', photoId)
  if (error) throw error
}

/**
 * Mark a bingo challenge as completed via RPC (race-safe, idempotent).
 */
export async function markChallengeCompleted(challengeId: number): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('mark_challenge_completed', {
    p_challenge_id: challengeId,
  })
  if (error) throw error
}
