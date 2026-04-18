"use client"

import { Suspense, useState, useEffect } from "react"
import { Heart } from "lucide-react"
import { PhotoUpload } from "@/components/photo-upload"
import { Navigation } from "@/components/navigation"
import { AdminAccessButton } from "@/components/admin-access-button"
import { AuthErrorHandler } from "@/components/auth-error-handler"
import { WelcomeScreen } from "@/components/welcome-screen"
import { getStoredToken, getStoredName, getGuestSession, type GuestSession } from "@/lib/guest"

export default function HomePage() {
  const [session, setSession] = useState<GuestSession | null | "loading">("loading")

  useEffect(() => {
    const token = getStoredToken()
    const name = getStoredName()

    if (!token || !name) {
      setSession(null)
      return
    }

    // Verify session still exists in DB
    getGuestSession().then((s) => {
      if (s) {
        setSession(s)
      } else {
        // Token in localStorage but not in DB — clear and show welcome
        localStorage.removeItem("wedding_guest_token")
        localStorage.removeItem("wedding_guest_name")
        setSession(null)
      }
    })
  }, [])

  const handleWelcomeComplete = (name: string) => {
    // Reload session from DB after creation
    getGuestSession().then((s) => {
      setSession(s ?? { token: getStoredToken()!, name, is_privileged: false })
    })
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

      <div className="absolute top-4 right-4 z-10">
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
            {session.is_privileged
              ? "Je hebt onbeperkte upload-toegang 🌟"
              : "Deel de mooiste momenten van deze dag"}
          </p>
        </header>

        <PhotoUpload
          guestName={session.name}
          isPrivileged={session.is_privileged}
          onUploadComplete={() => {}}
        />
      </div>

      <Navigation />
    </main>
  )
}
