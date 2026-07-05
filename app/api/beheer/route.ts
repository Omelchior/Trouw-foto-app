import { NextResponse } from "next/server"
import { beheerToken, BEHEER_COOKIE } from "@/lib/beheer"

/** Verify the shared beheer password and, on success, set the unlock cookie. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const password = typeof body?.password === "string" ? body.password : ""

  const expected = process.env.BEHEER_WACHTWOORD
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Beheer-wachtwoord niet geconfigureerd" },
      { status: 500 },
    )
  }
  // Hoofdletter-ongevoelig, zodat "Jawoord" en "jawoord" allebei werken.
  if (password.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const token = await beheerToken(expected)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(BEHEER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 uur
  })
  return res
}

/** Lock the beheer area again (clear the cookie). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(BEHEER_COOKIE, "", { path: "/", maxAge: 0 })
  return res
}
