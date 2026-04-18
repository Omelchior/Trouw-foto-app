"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Lock, Loader2, Mail, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

/**
 * Get the correct site URL for auth redirects.
 * Priority: NEXT_PUBLIC_SITE_URL > NEXT_PUBLIC_VERCEL_URL > window.location.origin
 */
function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    // Use explicit site URL if set (recommended for production)
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL
    }
    // Fallback to Vercel's auto-set URL
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    }
    // Last resort: current origin
    return window.location.origin
  }
  return ""
}

/** Maps error codes to user-friendly Dutch messages */
function getErrorMessage(errorCode: string | null, errorDescription: string | null): string {
  switch (errorCode) {
    case "otp_expired":
      return "De login link is verlopen. Vraag een nieuwe link aan."
    case "access_denied":
      return "Toegang geweigerd. Vraag een nieuwe login link aan."
    case "otp_disabled":
      return "Magic Link login is niet ingeschakeld. Neem contact op met de beheerder."
    default:
      if (errorDescription) {
        return decodeURIComponent(errorDescription.replace(/\+/g, " "))
      }
      return "Er ging iets mis bij het inloggen. Probeer het opnieuw."
  }
}

function AdminLoginContent() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")
  const errorCode = searchParams.get("error_code")
  const errorDescription = searchParams.get("error_description")

  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const hasError = errorParam || errorCode

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Vul je email adres in")
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const siteUrl = getSiteUrl()

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setIsSent(true)
    } catch (error) {
      console.error("Magic link error:", error)
      toast.error("Er ging iets mis bij het versturen")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            {isSent ? (
              <CheckCircle2 className="w-6 h-6 text-primary" />
            ) : hasError ? (
              <AlertTriangle className="w-6 h-6 text-destructive" />
            ) : (
              <Lock className="w-6 h-6 text-primary" />
            )}
          </div>
          <CardTitle className="font-serif text-2xl">
            {isSent
              ? "Check je inbox"
              : hasError
                ? "Link verlopen"
                : "Admin Login"}
          </CardTitle>
          <CardDescription>
            {isSent
              ? `We hebben een login link gestuurd naar ${email}`
              : hasError
                ? "Vraag hieronder een nieuwe login link aan"
                : "Ontvang een login link via email"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {hasError && !isSent && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{getErrorMessage(errorCode, errorDescription)}</span>
            </div>
          )}

          {isSent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Klik op de link in je email om in te loggen. De link is 1 uur
                  geldig. Check ook je spam folder als je de email niet ziet.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsSent(false)
                  setEmail("")
                }}
                className="w-full h-12 bg-transparent"
              >
                Ander email adres gebruiken
              </Button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Versturen...
                  </>
                ) : hasError ? (
                  "Nieuwe login link versturen"
                ) : (
                  "Verstuur login link"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </main>
      }
    >
      <AdminLoginContent />
    </Suspense>
  )
}
