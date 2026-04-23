"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, Loader2, CheckCircle2, ChevronLeft } from "lucide-react"
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

export default function RsvpPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [attending, setAttending] = useState<boolean | null>(null)
  const [partySize, setPartySize] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || attending === null) {
      toast.error("Vul alle verplichte velden in")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from("rsvp_responses").insert({
      user_id: user?.id ?? null,
      guest_name: name.trim(),
      email: email.trim(),
      attending,
      party_size: attending ? Math.max(1, partySize) : 1,
    })

    setLoading(false)

    if (error) {
      console.error(error)
      toast.error("Opslaan mislukt")
      return
    }

    setSubmitted(true)
    toast.success("Dank je wel!")
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="font-serif text-2xl">Aanmelding ontvangen</CardTitle>
            <CardDescription>
              {attending
                ? "We hebben je reactie opgeslagen. Tot op de grote dag!"
                : "Jammer dat je er niet bij kunt zijn — bedankt voor het laten weten."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Terug naar de app
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 py-12 bg-background">
      <div className="max-w-md mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Terug
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Heart className="w-7 h-7 text-primary fill-primary/30" />
            </div>
            <CardTitle className="font-serif text-2xl">Aanmelden</CardTitle>
            <CardDescription>
              Laat weten of je bij de bruiloft van Olaf &amp; Ester kan zijn.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rsvp-name">Naam *</Label>
                <Input
                  id="rsvp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jan Jansen"
                  className="h-11"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rsvp-email">Email *</Label>
                <Input
                  id="rsvp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jan@voorbeeld.nl"
                  className="h-11"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label>Kom je? *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={attending === true ? "default" : "outline"}
                    onClick={() => setAttending(true)}
                    className="h-11"
                  >
                    Ja, ik kom
                  </Button>
                  <Button
                    type="button"
                    variant={attending === false ? "default" : "outline"}
                    onClick={() => setAttending(false)}
                    className="h-11"
                  >
                    Helaas niet
                  </Button>
                </div>
              </div>

              {attending === true && (
                <div className="space-y-2">
                  <Label htmlFor="rsvp-size">Met hoeveel personen?</Label>
                  <Input
                    id="rsvp-size"
                    type="number"
                    min={1}
                    max={10}
                    value={partySize}
                    onChange={(e) => setPartySize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-11"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !name.trim() || !email.trim() || attending === null}
                className="w-full h-12 mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aanmelden versturen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
