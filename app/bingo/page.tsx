"use client"

import { useEffect, useState } from "react"
import { Target, Heart, Loader2 } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { AdminAccessButton } from "@/components/admin-access-button"
import { BingoBoard } from "@/components/bingo-board"
import { WelcomeScreen } from "@/components/welcome-screen"
import { getGuestSession, CHALLENGES, type GuestSession } from "@/lib/guest"
import { createClient } from "@/lib/supabase/client"

export default function BingoPage() {
  const [session, setSession] = useState<GuestSession | null | "loading">("loading")

  useEffect(() => {
    let active = true

    const load = async () => {
      const s = await getGuestSession()
      if (!active) return
      setSession(s)
    }

    load()

    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange(() => load())

    // Realtime: when user_profiles updates (challenge completed), reload
    const channel = supabase
      .channel("bingo-profile-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles" },
        () => load()
      )
      .subscribe()

    return () => {
      active = false
      sub.subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [])

  if (session === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (session === null) {
    return <WelcomeScreen onComplete={() => window.location.reload()} />
  }

  const total = CHALLENGES.length
  const done = session.completed_challenges.length

  return (
    <main className="min-h-screen pb-24">
      <div className="absolute top-4 right-4 z-10">
        <AdminAccessButton />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <header className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-1">
            Foto-bingo
          </h1>
          <p className="text-muted-foreground text-sm">
            Maak foto&apos;s om mensen te verbinden. Tik een vakje aan om aan die opdracht te werken.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-sm">
            <Heart className="w-4 h-4 text-primary fill-primary/30" />
            <span className="font-medium">{done} / {total} voltooid</span>
          </div>
        </header>

        <BingoBoard completed={session.completed_challenges} />

        <p className="text-xs text-center text-muted-foreground mt-6">
          Klik op een vakje om er een foto voor te uploaden.
        </p>
      </div>

      <Navigation />
    </main>
  )
}
