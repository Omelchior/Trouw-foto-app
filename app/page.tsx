"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { Heart, Shield, Target, Images, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PhotoUpload } from "@/components/photo-upload"
import { Navigation } from "@/components/navigation"
import { AdminAccessButton } from "@/components/admin-access-button"
import { AuthErrorHandler } from "@/components/auth-error-handler"
import { WelcomeScreen } from "@/components/welcome-screen"
import { getGuestSession, getMijnAanmelding, type GuestSession } from "@/lib/guest"
import { createClient } from "@/lib/supabase/client"

const TROUWDAG = new Date(2026, 7, 21) // vrijdag 21 augustus 2026

const SNELKOPPELINGEN = [
  { href: "/bingo", label: "Bingo", omschrijving: "Speel mee", icon: Target },
  { href: "/selectie", label: "Galerij", omschrijving: "Alle foto's", icon: Images },
  { href: "/info", label: "Info", omschrijving: "Programma & meer", icon: Info },
]

/** "Nog X dagen", "Vandaag is het zover!" of niets (na de bruiloft). */
function countdownTekst(): string | null {
  const vandaag = new Date()
  vandaag.setHours(0, 0, 0, 0)
  const dagen = Math.round((TROUWDAG.getTime() - vandaag.getTime()) / 86_400_000)
  if (dagen > 1) return `Nog ${dagen} dagen`
  if (dagen === 1) return "Nog 1 dag!"
  if (dagen === 0) return "Vandaag is het zover! 🎉"
  return null
}

export default function HomePage() {
  const [session, setSession] = useState<GuestSession | null | "loading">("loading")
  // Ingelogd maar nog niet aangemeld? Dan blijft het welkomscherm staan
  // zodat de aanmeld-bevestiging daar kan worden afgerond.
  const [aangemeld, setAangemeld] = useState(true)
  const [countdown, setCountdown] = useState<string | null>(null)

  // In een effect zodat server- en client-render niet verschillen.
  useEffect(() => {
    setCountdown(countdownTekst())
  }, [])

  useEffect(() => {
    let active = true

    const load = async () => {
      const s = await getGuestSession()
      const a = s ? await getMijnAanmelding() : null
      if (!active) return
      setSession(s)
      setAangemeld(a ?? true)
    }

    load()

    // Refresh on auth change (sign-in, token refresh, etc.)
    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleWelcomeComplete = async () => {
    const s = await getGuestSession()
    setAangemeld(true)
    setSession(s)
  }

  if (session === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Heart className="w-8 h-8 text-primary animate-pulse" />
      </div>
    )
  }

  if (session === null || !aangemeld) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />
  }

  return (
    <main className="min-h-screen pb-20">
      <Suspense fallback={null}>
        <AuthErrorHandler />
      </Suspense>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
        {session.is_privileged && (
          <Link href={session.role === "admin" ? "/admin" : "/ceremoniemeester"}>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Beheer"
            >
              <Shield className="w-4 h-4 mr-2" />
              <span className="text-sm">Beheer</span>
            </Button>
          </Link>
        )}
        <AdminAccessButton />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <header className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Heart className="w-8 h-8 text-primary fill-primary/30" />
          </div>
          <h1 className="font-serif text-4xl font-bold text-foreground mb-1">
            Olaf &amp; Ester
          </h1>
          <p className="font-medium text-primary mb-2">Vrijdag 21 augustus 2026</p>
          {countdown && (
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
              {countdown}
            </span>
          )}
        </header>

        <div>
          <div className="text-center mb-4">
            <h2 className="font-serif text-xl font-bold text-foreground">
              Hé {session.name.split(" ")[0]}! 👋
            </h2>
            <p className="text-sm text-muted-foreground">
              Deel de mooiste momenten van deze dag
            </p>
          </div>
          <PhotoUpload
            guestName={session.name}
            userId={session.user_id}
            onUploadComplete={() => {}}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {SNELKOPPELINGEN.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:bg-muted/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.omschrijving}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <Navigation />
    </main>
  )
}
