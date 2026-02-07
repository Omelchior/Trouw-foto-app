"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * Catches Supabase auth errors that land on the root URL.
 * When a magic link fails/expires, Supabase redirects to the Site URL (root)
 * with error params. This component detects those and redirects to admin login.
 */
export function AuthErrorHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get("error")
    const errorCode = searchParams.get("error_code")
    const errorDescription = searchParams.get("error_description")

    // Also check hash fragment for errors (Supabase sometimes puts them there)
    const hash = window.location.hash
    const hashError = hash.includes("error=")

    if (error || hashError) {
      // Build redirect URL with error info
      const params = new URLSearchParams()
      if (error) params.set("error", error)
      if (errorCode) params.set("error_code", errorCode)
      if (errorDescription) params.set("error_description", errorDescription)

      // Redirect to admin login with the error details
      router.replace(`/admin/login?${params.toString()}`)
    }
  }, [searchParams, router])

  return null
}
