import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  const isAdminRoute =
    path.startsWith('/admin') && !path.startsWith('/admin/login')
  const isCmRoute =
    path.startsWith('/ceremoniemeester') && !path.startsWith('/ceremoniemeester/login')

  // For role-gated routes: need a real (non-anonymous) user AND the right role.
  if (isAdminRoute || isCmRoute) {
    const isAnon = (user as { is_anonymous?: boolean } | null)?.is_anonymous === true

    if (!user || isAnon) {
      const url = request.nextUrl.clone()
      url.pathname = isCmRoute ? '/ceremoniemeester/login' : '/admin/login'
      return NextResponse.redirect(url)
    }

    // Fetch role from user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const role = profile?.role as string | undefined

    if (isAdminRoute && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    if (isCmRoute && role !== 'ceremony_master' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Redirect already-authenticated admins away from admin login
  if (path === '/admin/login' && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile?.role === 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
  }

  // Redirect authenticated CMs away from their login
  if (path === '/ceremoniemeester/login' && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile?.role === 'ceremony_master' || profile?.role === 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/ceremoniemeester'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
