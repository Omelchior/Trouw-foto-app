// Shared helper for the "beheer" (admin/ceremoniemeester) password gate.
// Used by both the API route (Node runtime) and the middleware (Edge runtime),
// so it relies only on the Web Crypto API available in both.

export const BEHEER_COOKIE = 'beheer_ok'

/** Deterministic, non-reversible token derived from the shared beheer password. */
export async function beheerToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`beheer:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
