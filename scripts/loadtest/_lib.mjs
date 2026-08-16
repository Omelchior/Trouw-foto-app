// Gedeelde helpers voor de load-test. Leest .env.local zelf in (geen secrets in
// de shell), maakt een Supabase-client en kan inloggen als een gast/admin.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')

export function loadEnv() {
  const raw = readFileSync(resolve(projectRoot, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
  return env
}

export function makeClient() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY ontbreekt in .env.local')
  return createClient(url, anon, { auth: { persistSession: false } })
}

// Zelfde afleiding als lib/guest.ts — voorspelbaar wachtwoord (gat #1).
const GUEST_EMAIL_DOMAIN = 'gast.trouwfoto.nl'
const guestEmail = (slug) => `${slug}@${GUEST_EMAIL_DOMAIN}`
const guestPassword = (slug) => `gast-${slug}-Trouw!2026`

/** Log in als een gast uit de lijst (maakt het account aan bij eerste keer). */
export async function loginAsGuest(supabase, slug) {
  const email = guestEmail(slug)
  const password = guestPassword(slug)
  let { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const up = await supabase.auth.signUp({ email, password })
    if (up.error) {
      const retry = await supabase.auth.signInWithPassword({ email, password })
      if (retry.error) throw up.error
    }
  }
  const { error: claimErr } = await supabase.rpc('claim_guest_profile', { p_slug: slug })
  if (claimErr) throw claimErr
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const LOADTEST_TAG = 'LOADTEST'
export const LOADTEST_PREFIX = 'loadtest/'

/** Distinct gekleurde SVG met een groot volgnummer, zodat "hangen" zichtbaar is. */
export function testSvg(n) {
  const hue = (n * 47) % 360
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="750">` +
    `<rect width="100%" height="100%" fill="hsl(${hue} 70% 45%)"/>` +
    `<text x="50%" y="50%" font-family="sans-serif" font-size="320" fill="white" ` +
    `text-anchor="middle" dominant-baseline="central">${n}</text></svg>`
}

export function argInt(name, dflt) {
  const pre = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(pre))
  if (!hit) return dflt
  const v = parseInt(hit.slice(pre.length), 10)
  return Number.isNaN(v) ? dflt : v
}
