import { createClient } from './supabase/client'

const TOKEN_KEY = 'wedding_guest_token'
const NAME_KEY = 'wedding_guest_name'

export const MAX_UPLOADS = 10
export const MAX_FOTOBOEK = 5
export const VIP_CODE = 'FOTO2025'

export interface GuestSession {
  token: string
  name: string
  is_privileged: boolean
}

export interface UploadCounts {
  uploaded: number
  fotoboek: number
}

export const CHALLENGES = [
  { id: 1, emoji: '🤳', text: 'Selfie met het bruidspaar' },
  { id: 2, emoji: '💃', text: 'Beste dansmove van de avond' },
  { id: 3, emoji: '🍽️', text: 'Het lekkerste gerecht' },
  { id: 4, emoji: '😂', text: 'De grappigste foto' },
  { id: 5, emoji: '👨‍👩‍👧', text: 'Groepsfoto van je tafel' },
  { id: 6, emoji: '🌸', text: 'Iets moois dat je opvalt' },
  { id: 7, emoji: '🎉', text: 'Een moment om te onthouden' },
  { id: 8, emoji: '🕵️', text: 'Heimelijke foto' },
]

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredName(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(NAME_KEY)
}

export async function createGuestSession(
  name: string,
  vipCode?: string
): Promise<GuestSession> {
  const supabase = createClient()
  const token = crypto.randomUUID()
  const is_privileged = vipCode?.trim().toUpperCase() === VIP_CODE

  const { error } = await supabase
    .from('guest_sessions')
    .insert({ token, name: name.trim(), is_privileged })

  if (error) throw error

  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(NAME_KEY, name.trim())

  return { token, name: name.trim(), is_privileged }
}

export async function getGuestSession(): Promise<GuestSession | null> {
  const token = getStoredToken()
  if (!token) return null

  const supabase = createClient()
  const { data, error } = await supabase
    .from('guest_sessions')
    .select('token, name, is_privileged')
    .eq('token', token)
    .single()

  if (error || !data) return null
  return data as GuestSession
}

export async function getUploadCounts(token: string): Promise<UploadCounts> {
  const supabase = createClient()

  const { count: uploaded } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .eq('guest_token', token)

  const { count: fotoboek } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .eq('guest_token', token)
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
