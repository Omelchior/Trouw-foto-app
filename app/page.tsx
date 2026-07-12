"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { Heart, Shield, Target, Images, Info, Lock, Clock, ChevronRight, MapPin, Shirt, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PhotoUpload } from "@/components/photo-upload"
import { Navigation } from "@/components/navigation"
import { LogoutButton } from "@/components/logout-button"
import { AuthErrorHandler } from "@/components/auth-error-handler"
import { WelcomeScreen } from "@/components/welcome-screen"
import { getGuestSession, getMijnAanwezigheid, type GuestSession } from "@/lib/guest"
import { createClient } from "@/lib/supabase/client"
import {
  TROUWDATUM_TEKST,
  isAppOpen,
  countdownTekst,
  volgendProgrammapunt,
} from "@/lib/bruiloft"

const SNELKOPPELINGEN = [
  { href: "/bingo", label: "Opdrachten", omschrijving: "Ga op fotomissie", icon: Target },
  { href: "/selectie", label: "Galerij", omschrijving: "Alle foto's", icon: Images },
  { href: "/info", label: "Info", omschrijving: "Programma & meer", icon: Info },
]

/** Voorproefje van de infopagina op het vergrendelde startscherm. */
const INFO_HIGHLIGHTS = [
  { icon: Clock, label: "Het programma" },
  { icon: MapPin, label: "De route naar Mereveld" },
  { icon: Shirt, label: "De dresscode-kleuren" },
  { icon: Gift, label: "Onze cadeautip" },
]

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
      const a = s ? await getMijnAanwezigheid() : null
      if (!active) return
      setSession(s)
      setAangemeld(a === null || a === "aangemeld")
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

  // Beheer en ceremoniemeesters zien de volledige app ook vóór de trouwdag.
  const open = isAppOpen() || session.is_privileged
  const programmapunt = volgendProgrammapunt()

  return (
    <main className="min-h-screen pb-20">
      <Suspense fallback={null}>
        <AuthErrorHandler />
      </Suspense>

      {session.is_privileged && (
        <div className="absolute top-4 left-4 z-10">
          <Link href="/admin">
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
        </div>
      )}
      <div className="absolute top-4 right-4 z-10">
        <LogoutButton />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <header className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Heart className="w-8 h-8 text-primary fill-primary/30" />
          </div>
          <h1 className="font-serif text-4xl font-bold text-foreground mb-1">
            Olaf &amp; Ester
          </h1>
          <p className="font-medium text-primary mb-2">{TROUWDATUM_TEKST}</p>
          {countdown && (
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
              {countdown}
            </span>
          )}
        </header>

        {open ? (
          <>
            {programmapunt && (
              <Link
                href="/info"
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-primary font-medium uppercase tracking-wide">
                    Straks om {programmapunt.tijd} uur
                  </p>
                  <p className="font-medium text-foreground">
                    {programmapunt.titel}: {programmapunt.omschrijving}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </Link>
            )}

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

            {!isAppOpen() && (
              <p className="text-center text-xs text-muted-foreground">
                Jij ziet als beheerder alvast alles; gasten kunnen pas op de
                trouwdag aan de slag.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="text-center">
              <h2 className="font-serif text-xl font-bold text-foreground">
                Hé {session.name.split(" ")[0]}! 👋
              </h2>
              <p className="text-sm text-muted-foreground">
                Wat fijn dat je erbij bent op onze bruiloft.
              </p>
            </div>

            <Link
              href="/info"
              className="block rounded-xl border border-border bg-card p-5 hover:bg-muted/60 transition-colors"
            >
              <p className="font-serif text-lg font-bold text-foreground mb-1">
                Nieuwsgierig naar de grote dag? ✨
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Neem alvast een kijkje, dan weet je precies wat je te wachten
                staat:
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {INFO_HIGHLIGHTS.map((h) => {
                  const HIcon = h.icon
                  return (
                    <div key={h.label} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <HIcon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-foreground">{h.label}</span>
                    </div>
                  )
                })}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Ontdek het hier <ChevronRight className="w-4 h-4" />
              </span>
            </Link>

            <div className="rounded-xl bg-muted p-5 text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-background flex items-center justify-center">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">
                De rest van de app opent op de trouwdag
              </p>
              <p className="text-sm text-muted-foreground">
                Vanaf {TROUWDATUM_TEKST.toLowerCase()} deel je hier je mooiste
                foto&apos;s, ga je op pad met leuke foto-opdrachten en bewonder
                je alle kiekjes van iedereen in de galerij. Tot dan!
              </p>
            </div>
          </>
        )}
      </div>

      <Navigation />
    </main>
  )
}
