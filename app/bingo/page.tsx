"use client"

import { useEffect, useState } from "react"
import { Target, Heart, Loader2 } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { AdminAccessButton } from "@/components/admin-access-button"
import { BingoBoard, type BingoPhoto } from "@/components/bingo-board"
import { WelcomeScreen } from "@/components/welcome-screen"
import { getGuestSession, CHALLENGES, type GuestSession } from "@/lib/guest"
import { createClient } from "@/lib/supabase/client"

export default function BingoPage() {
  const [session, setSession] = useState<GuestSession | null | "loading">("loading")
  const [photosByChallenge, setPhotosByChallenge] = useState<Record<number, BingoPhoto>>({})

  const loadSessionAndPhotos = async () => {
    const s = await getGuestSession()
    if (!s) {
      setSession(null)
      return
    }
    setSession(s)

    const supabase = createClient()
    const { data, error } = await supabase
      .from("photos")
      .select("id, storage_path, uploaded_by, uploaded_at, is_selected, challenge_id")
      .eq("user_id", s.user_id)
      .not("challenge_id", "is", null)
      .order("uploaded_at", { ascending: false })

    if (error) {
      console.error("Error loading own photos:", error)
      setPhotosByChallenge({})
      return
    }

    const map: Record<number, BingoPhoto> = {}
    for (const p of data || []) {
      const cid = p.challenge_id as number | null
      if (cid == null) continue
      // Only keep the most recent photo per challenge
      if (!map[cid]) {
        map[cid] = {
          id: p.id,
          storage_path: p.storage_path,
          uploaded_by: p.uploaded_by,
          uploaded_at: p.uploaded_at,
          is_selected: p.is_selected,
          url: supabase.storage.from("wedding-photos").getPublicUrl(p.storage_path).data.publicUrl,
        }
      }
    }
    setPhotosByChallenge(map)
  }

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!active) return
      await loadSessionAndPhotos()
    }

    run()

    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange(() => run())

    const profileChannel = supabase
      .channel("bingo-profile-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles" },
        () => run()
      )
      .subscribe()

    const photosChannel = supabase
      .channel("bingo-photos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photos" },
        () => run()
      )
      .subscribe()

    return () => {
      active = false
      sub.subscription.unsubscribe()
      supabase.removeChannel(profileChannel)
      supabase.removeChannel(photosChannel)
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
            Maak foto&apos;s om mensen te verbinden. Tik een leeg vakje aan om eraan te werken;
            tik een voltooid vakje aan om je foto te bekijken.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-sm">
            <Heart className="w-4 h-4 text-primary fill-primary/30" />
            <span className="font-medium">{done} / {total} voltooid</span>
          </div>
        </header>

        <BingoBoard
          completed={session.completed_challenges}
          photosByChallenge={photosByChallenge}
        />
      </div>

      <Navigation />
    </main>
  )
}
