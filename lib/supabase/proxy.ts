import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { beheerToken, BEHEER_COOKIE } from '@/lib/beheer'
import { GESLOTEN_VOOR_TROUWDAG, effectiveOpen, type OpenModus } from '@/lib/bruiloft'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Beheer-routes: admins én ceremoniemeesters zien en kunnen hetzelfde.
  const isAdminRoute =
    path.startsWith('/admin') && !path.startsWith('/admin/login')

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    return NextResponse.redirect(url)
  }

  // Has the visitor unlocked the beheer area with the shared password?
  let beheerValid = false
  const beheerCookie = request.cookies.get(BEHEER_COOKIE)?.value
  const beheerPassword = process.env.BEHEER_WACHTWOORD
  if (beheerCookie && beheerPassword) {
    beheerValid = beheerCookie === (await beheerToken(beheerPassword))
  }

  // Role-gated routes: need a real (non-anonymous) user, the right role, AND
  // the beheer password unlock.
  if (isAdminRoute) {
    const isAnon = (user as { is_anonymous?: boolean } | null)?.is_anonymous === true

    // Not logged in → pick your name on the homepage first.
    if (!user || isAnon) {
      return redirectTo('/')
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const role = profile?.role as string | undefined

    // Fotograaf mag ook het beheer in (voor het selecteren van foto's).
    if (role !== 'admin' && role !== 'ceremony_master' && role !== 'fotograaf') {
      return redirectTo('/')
    }

    // Right role but the beheer area is still locked → ask for the password.
    if (!beheerValid) {
      return redirectTo('/admin/login')
    }
  }

  // De gastenpagina's zijn gesloten tot de app opengaat: standaard om 20:30 op
  // de trouwdag, maar het beheer kan dit handmatig overrulen (nu openen / dicht
  // houden) via de app_status-schakelaar. Beheer en ceremoniemeesters mogen er
  // altijd al in.
  if (GESLOTEN_VOOR_TROUWDAG.some((p) => path.startsWith(p))) {
    let modus: OpenModus = 'auto'
    const { data: status } = await supabase
      .from('app_status')
      .select('open_modus')
      .eq('id', 1)
      .maybeSingle()
    const gelezen = (status as { open_modus?: OpenModus } | null)?.open_modus
    if (gelezen) modus = gelezen

    if (!effectiveOpen(modus)) {
      if (!user) {
        return redirectTo('/')
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      const role = profile?.role as string | undefined
      if (role !== 'admin' && role !== 'ceremony_master') {
        return redirectTo('/info')
      }
    }
  }

  // Already unlocked? Skip the password page.
  if (path === '/admin/login' && user && beheerValid) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (
      profile?.role === 'admin' ||
      profile?.role === 'ceremony_master' ||
      profile?.role === 'fotograaf'
    ) {
      return redirectTo('/admin')
    }
  }

  return supabaseResponse
}
