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
  /** Zelfgekozen vervolg-opdracht die nog openstaat (null = geen gekozen). */
  huidige_opdracht: number | null
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

// 33 verbindings-opdrachten (swipebare carrousel)
export const CHALLENGES: Challenge[] = [
  { id: 1,  text: 'Selfie met het bruidspaar' },
  { id: 2,  text: 'Groepsfoto met minimaal 2 mensen die je vandaag voor het eerst hebt ontmoet' },
  { id: 3,  text: 'Duo-foto met iemand uit een andere leeftijdsgroep (>20 jaar verschil)' },
  { id: 4,  text: 'Foto met iemand die dezelfde schoenmaat heeft' },
  { id: 5,  text: 'Foto met de DJ van de avond' },
  { id: 6,  text: 'Jij + iemand van de familie van de bruid + iemand van de familie van de bruidegom' },
  { id: 7,  text: 'Foto met iemand die dezelfde kleur draagt als jij' },
  { id: 8,  text: 'Foto waarop je met 5+ anderen proost' },
  { id: 9,  text: 'Foto met iemand wiens naam met dezelfde letter begint als die van jou' },
  { id: 10, text: 'Foto met iemand die in een andere provincie woont dan jij' },
  { id: 11, text: 'Duo-foto waarin jullie hetzelfde gebaar maken' },
  { id: 12, text: 'Foto met iemand waarop jullie het bruidspaar nadoen' },
  { id: 13, text: 'Foto met een stel (anders dan het bruidspaar)' },
  { id: 14, text: 'Foto met iemand die een biertje drinkt én iemand die een wijntje drinkt' },
  { id: 15, text: 'Foto met iemand ouder dan de bruid + iemand jonger dan de bruidegom' },
  { id: 16, text: 'Foto met de langste of kortste persoon van het feest' },
  { id: 17, text: 'Foto met iemand die een stropdas draagt' },
  { id: 18, text: 'Foto met iemand die een snor heeft' },
  { id: 19, text: 'Foto met iemand voor de bar' },
  { id: 20, text: 'Foto met iemand van het personeel van de trouwlocatie' },
  { id: 21, text: 'Foto samen met één van de ceremoniemeesters' },
  { id: 22, text: 'Foto met iemand die een ander kledingstuk draagt dan jij' },
  { id: 23, text: 'Foto met iemand die lekker aan het dansen is' },
  { id: 24, text: 'Foto (samen met iemand anders) waarop iets roods te zien is' },
  { id: 25, text: 'Foto (samen met iemand anders) waarop iets gouds te zien is' },
  { id: 26, text: 'Foto vanuit kikkerperspectief, met zoveel mogelijk mensen erop' },
  { id: 27, text: 'Foto samen met anderen waarop jullie samen één hart uitbeelden' },
  { id: 28, text: 'Foto van mensen die hun handen in de lucht hebben tijdens het dansen' },
  { id: 29, text: 'Foto met iemand die in dezelfde maand jarig is als jij' },
  { id: 30, text: 'Foto samen met iemand waarop jullie in de lucht springen' },
  { id: 31, text: 'Foto met iemand die dezelfde haarkleur heeft (of, net als jij, geen haar)' },
  { id: 32, text: 'Foto samen met 2 anderen waarop jullie een gekke bek trekken' },
  { id: 33, text: 'Foto samen met 5 mensen van het andere geslacht' },
]

export function getChallenge(id: number): Challenge | undefined {
  return CHALLENGES.find(c => c.id === id)
}

/**
 * Haal de (bewerkbare) opdracht-teksten uit de database als map id -> tekst.
 * Leeg object bij een fout of zolang migratie 013 nog niet is uitgevoerd;
 * de app valt dan terug op de hardcoded CHALLENGES-teksten.
 */
export async function getOpdrachtTeksten(): Promise<Record<number, string>> {
  const supabase = createClient()
  const { data, error } = await supabase.from('opdracht_teksten').select('id, tekst')
  if (error || !data) return {}
  const map: Record<number, string> = {}
  for (const r of data as { id: number; tekst: string }[]) map[r.id] = r.tekst
  return map
}

/** Beheer/ceremoniemeester past de tekst van één opdracht aan. */
export async function zetOpdrachtTekst(id: number, tekst: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('opdracht_teksten')
    .upsert({ id, tekst, bijgewerkt_op: new Date().toISOString() })
  if (error) throw error
}

/** Voeg de bewerkte teksten samen met de standaardlijst (op id). */
export function mergeOpdrachten(teksten: Record<number, string>): Challenge[] {
  return CHALLENGES.map(c => ({ ...c, text: teksten[c.id] ?? c.text }))
}

/**
 * De opdracht die een gast nu open heeft staan: eerst de door beheer
 * toegewezen eerste opdracht (zolang niet gedaan), daarna de zelfgekozen
 * vervolg-opdracht (zolang niet gedaan). Null = niets openstaand.
 * Gedeeld door de opdracht-carrousel en het beheeroverzicht.
 */
export function berekenActieveOpdracht(
  eerste: number | null,
  completed: number[],
  gekozen: number | null,
): number | null {
  const done = new Set(completed)
  if (eerste != null && !done.has(eerste)) return eerste
  if (gekozen != null && !done.has(gekozen)) return gekozen
  return null
}

/**
 * Kies een willekeurige opdracht die de gast nog niet heeft gedaan.
 * Geeft null als alle opdrachten voltooid zijn.
 */
export function volgendeOpdracht(completed: number[], skip?: number | null): Challenge | null {
  const done = new Set(completed)
  if (skip != null) done.add(skip)
  const open = CHALLENGES.filter(c => !done.has(c.id))
  if (open.length === 0) return null
  return open[Math.floor(Math.random() * open.length)]
}

/** Beheer-capable roles (mogen het beheer in, achter het wachtwoord). */
export function isPrivilegedRole(role: Role): boolean {
  return role === 'ceremony_master' || role === 'admin'
}

/**
 * Rollen met een Beheer-knop in de navigatie: beheer, ceremoniemeesters
 * én de fotograaf (die selecteert foto's voor de diavoorstelling).
 */
export function heeftBeheerToegang(role: Role): boolean {
  return isPrivilegedRole(role) || role === 'fotograaf'
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

/**
 * Is de ingelogde gast een dag- of avondgast?
 * Geeft null bij onbekend (geen gast-rij of dagdeel niet ingevuld).
 */
export async function getMijnDagdeel(): Promise<'dag' | 'avond' | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const slug = (user?.email ?? '').split('@')[0]
  if (!slug) return null

  const { data, error } = await supabase
    .from('guests')
    .select('dagdeel')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null
  return (data as { dagdeel: 'dag' | 'avond' | null }).dagdeel
}

/**
 * De foto-opdracht die via de gastenlijst aan de ingelogde gast is gekoppeld.
 * Geeft null bij onbekend (geen gast-rij of geen opdracht toegewezen).
 */
export async function getMijnEersteOpdracht(): Promise<number | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const slug = (user?.email ?? '').split('@')[0]
  if (!slug) return null

  const { data, error } = await supabase
    .from('guests')
    .select('eerste_opdracht')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null
  return (data as { eerste_opdracht: number | null }).eerste_opdracht
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
    .select('user_id, name, role, label, email, completed_challenges, huidige_opdracht')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!error && data) return data as UserProfile

  // Fallback zolang migratie 012 (huidige_opdracht-kolom) nog niet is uitgevoerd.
  const oud = await supabase
    .from('user_profiles')
    .select('user_id, name, role, label, email, completed_challenges')
    .eq('user_id', user.id)
    .maybeSingle()
  if (oud.error || !oud.data) return null
  return { ...(oud.data as Omit<UserProfile, 'huidige_opdracht'>), huidige_opdracht: null }
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

/**
 * Zet (of wist met null) de zelfgekozen vervolg-opdracht van de ingelogde gast.
 * Zo blijft de opdracht vast staan tot hij is afgerond en kan beheer live zien
 * wie welke opdracht open heeft staan.
 */
export async function zetMijnOpdracht(challengeId: number | null): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('zet_mijn_opdracht', { p_id: challengeId })
  if (error) throw error
}
