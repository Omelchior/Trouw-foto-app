"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { Heart, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PhotoUpload } from "@/components/photo-upload"
import { Navigation } from "@/components/navigation"
import { AdminAccessButton } from "@/components/admin-access-button"
import { AuthErrorHandler } from "@/components/auth-error-handler"
import { WelcomeScreen } from "@/components/welcome-screen"
import { getGuestSession, type GuestSession } from "@/lib/guest"
import { createClient } from "@/lib/supabase/client"

export default function HomePage() {
  const [session, setSession] = useState<GuestSession | null | "loading">("loading")

  useEffect(() => {
    let active = true

    const load = async () => {
      const s = await getGuestSession()
      if (!active) return
      setSession(s)
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
    setSession(s)
  }

  if (session === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Heart className="w-8 h-8 text-primary animate-pulse" />
      </div>
    )
  }

  if (session === null) {
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

      <div className="max-w-lg mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-1">
            Hé {session.name.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            Deel de mooiste momenten van deze dag
          </p>
        </header>

        <PhotoUpload
          guestName={session.name}
          userId={session.user_id}
          onUploadComplete={() => {}}
        />
      </div>

      <Navigation />
    </main>
  )
}
