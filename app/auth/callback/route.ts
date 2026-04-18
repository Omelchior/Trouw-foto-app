import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") ?? "/admin"

  // Determine the correct base URL for redirects
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"
  const isLocalEnv = process.env.NODE_ENV === "development"
  
  let baseUrl: string
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  } else if (!isLocalEnv && forwardedHost) {
    baseUrl = `${forwardedProto}://${forwardedHost}`
  } else {
    baseUrl = requestUrl.origin
  }

  // Handle error params (Supabase sometimes sends errors to callback)
  const error = requestUrl.searchParams.get("error")
  const errorCode = requestUrl.searchParams.get("error_code")
  const errorDescription = requestUrl.searchParams.get("error_description")

  if (error) {
    const errorParams = new URLSearchParams()
    errorParams.set("error", error)
    if (errorCode) errorParams.set("error_code", errorCode)
    if (errorDescription) errorParams.set("error_description", errorDescription)
    return NextResponse.redirect(`${baseUrl}/admin/login?${errorParams.toString()}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      return NextResponse.redirect(`${baseUrl}${next}`)
    }

    // Exchange failed - redirect with error info
    const params = new URLSearchParams({
      error: "auth_callback_failed",
      error_description: exchangeError.message,
    })
    return NextResponse.redirect(`${baseUrl}/admin/login?${params.toString()}`)
  }

  // No code provided - redirect to login
  return NextResponse.redirect(`${baseUrl}/admin/login?error=no_code`)
}
