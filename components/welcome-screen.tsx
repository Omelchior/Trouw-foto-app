"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart, Loader2, Search, Crown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAsGuest, getGuestList, type GuestListEntry } from "@/lib/guest"
import { toast } from "sonner"

interface WelcomeScreenProps {
  onComplete: (name: string) => void
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [guests, setGuests] = useState<GuestListEntry[] | "loading">("loading")
  const [query, setQuery] = useState("")
  const [loggingIn, setLoggingIn] = useState<string | null>(null)

  useEffect(() => {
    getGuestList().then((list) => setGuests(list))
  }, [])

  const filtered = useMemo(() => {
    if (guests === "loading") return []
    const q = query.trim().toLowerCase()
    if (!q) return guests
    return guests.filter((g) => g.name.toLowerCase().includes(q))
  }, [guests, query])

  const handlePick = async (guest: GuestListEntry) => {
    if (loggingIn) return
    setLoggingIn(guest.slug)
    try {
      const session = await loginAsGuest(guest.slug)
      onComplete(session.name)
    } catch (err) {
      console.error(err)
      toast.error("Inloggen mislukt. Probeer het opnieuw.")
      setLoggingIn(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col max-h-[90vh]">
        <div className="text-center mb-6 shrink-0">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Heart className="w-10 h-10 text-primary fill-primary/30" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Olaf &amp; Ester
          </h1>
          <p className="text-muted-foreground">
            Welkom op onze bruiloft! 🎊<br />
            Kies je naam om in te loggen.
          </p>
        </div>

        <div className="space-y-2 shrink-0">
          <Label htmlFor="welcome-search" className="text-base font-medium">
            Wie ben jij?
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="welcome-search"
              placeholder="Zoek je naam..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-12 text-base"
              autoFocus
              autoComplete="off"
            />
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {guests === "loading" ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground px-4">
              Geen naam gevonden. Staat je naam er niet bij? Vraag het bruidspaar.
            </div>
          ) : (
            filtered.map((guest) => (
              <button
                key={guest.slug}
                type="button"
                onClick={() => handlePick(guest)}
                disabled={!!loggingIn}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2 font-medium">
                  {guest.name}
                  {guest.label && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <Crown className="w-3 h-3" />
                      {guest.label}
                    </span>
                  )}
                </span>
                {loggingIn === guest.slug && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
