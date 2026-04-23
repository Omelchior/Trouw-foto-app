"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, Loader2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createGuestSession } from "@/lib/guest"
import { toast } from "sonner"

interface WelcomeScreenProps {
  onComplete: (name: string) => void
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Vul je naam in")
      return
    }

    setIsLoading(true)
    try {
      const session = await createGuestSession(name)
      onComplete(session.name)
    } catch (err) {
      console.error(err)
      toast.error("Er ging iets mis. Probeer opnieuw.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Heart className="w-10 h-10 text-primary fill-primary/30" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Olaf &amp; Ester
          </h1>
          <p className="text-muted-foreground">
            Welkom op onze bruiloft! 🎊<br />
            Help ons de mooiste momenten vast te leggen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcome-name" className="text-base font-medium">
              Wie ben jij?
            </Label>
            <Input
              id="welcome-name"
              placeholder="Bijv. Jan & Marieke"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base"
              autoFocus
              autoComplete="name"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full h-12 text-base gap-2 mt-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Laten we beginnen
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <Link
            href="/login"
            className="text-sm text-muted-foreground underline underline-offset-2 inline-block"
          >
            Al eens eerder ingelogd? Log in met je email
          </Link>
          <div>
            <Link
              href="/rsvp"
              className="text-sm text-muted-foreground underline underline-offset-2 inline-block"
            >
              Aanmelden voor de bruiloft →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
