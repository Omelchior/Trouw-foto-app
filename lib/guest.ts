import { createClient } from './supabase/client'

export const MAX_UPLOADS = 10
export const MAX_FOTOBOEK = 5
export const BINGO_SIZE = 5

export type Role = 'guest' | 'vip' | 'ceremony_master' | 'admin'

export interface UserProfile {
  user_id: string
  name: string
  role: Role
  email: string | null
  completed_challenges: number[]
}

export interface GuestSession extends UserProfile {
  token: string        // alias for user_id (backwards-compat)
  is_privileged: boolean
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
  { id: 14, text: 'Vraag een onbekende naar zijn favoriete herinnering aan het bruidspaar — foto erbij' },
  { id: 15, text: 'Foto met iemand ouder dan de bruid + iemand jonger dan de bruidegom' },
  { id: 16, text: 'Twee gasten die elkaar een knuffel geven' },
  { id: 17, text: 'Foto waarin iedereen naar hetzelfde punt wijst' },
  { id: 18, text: 'Spiegel- of schaduwfoto met een andere gast' },
  { id: 19, text: 'Foto met iemand die de eerste dans van het bruidspaar kent' },
  { id: 20, text: 'Twee mensen die elkaar eerst niet kenden, nu samen lachen' },
  { id: 21, text: 'Vraag iemand om zijn favoriete eigenschap van de bruid/bruidegom — foto erbij' },
  { id: 22, text: 'Groepsselfie: zo veel mogelijk mensen in één frame' },
  { id: 23, text: 'Foto met iemand die iets unieks aanheeft' },
  { id: 24, text: 'Duo van de jongste + oudste gast' },
  { id: 25, text: 'Foto met iemand die al heeft gedanst vanavond' },
]

export function getChallenge(id: number): Challenge | undefined {
  return CHALLENGES.find(c => c.id === id)
}

export function isPrivilegedRole(role: Role): boolean {
  return role !== 'guest'
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
    .select('user_id, name, role, email, completed_challenges')
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
 * Sign in anonymously with Supabase, then insert a user_profiles row with the given name.
 * If the user is already signed in (anonymous or email), just ensures the profile exists.
 */
export async function createGuestSession(name: string): Promise<GuestSession> {
  const supabase = createClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Naam is verplicht')

  // If already signed in, reuse the user.
  let { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    user = data.user
  }

  if (!user) throw new Error('Kon geen sessie maken')

  // Upsert profile row
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: user.id, name: trimmed },
      { onConflict: 'user_id' }
    )

  if (profileError) throw profileError

  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Profiel niet gevonden na aanmaken')

  return {
    ...profile,
    token: profile.user_id,
    is_privileged: isPrivilegedRole(profile.role),
  }
}

/** Update the current user's display name */
export async function updateProfileName(name: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Niet ingelogd')

  const { error } = await supabase
    .from('user_profiles')
    .update({ name: name.trim() })
    .eq('user_id', user.id)

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
