"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { User, Mail, CheckCircle2, Loader2, LogOut, ChevronLeft, Save } from "lucide-react"
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
import { Navigation } from "@/components/navigation"
import { createClient } from "@/lib/supabase/client"
import { getCurrentProfile, updateProfileName, type UserProfile } from "@/lib/guest"
import { toast } from "sonner"

export default function ProfielPage() {
  const [profile, setProfile] = useState<UserProfile | null | "loading">("loading")
  const [editName, setEditName] = useState("")
  const [savingName, setSavingName] = useState(false)

  const [showEmailField, setShowEmailField] = useState(false)
  const [email, setEmail] = useState("")
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    getCurrentProfile().then((p) => {
      setProfile(p)
      if (p) setEditName(p.name)
    })
  }, [])

  const handleSaveName = async () => {
    if (!editName.trim()) {
      toast.error("Naam mag niet leeg zijn")
      return
    }
    setSavingName(true)
    try {
      await updateProfileName(editName)
      const p = await getCurrentProfile()
      setProfile(p)
      toast.success("Naam bijgewerkt")
    } catch {
      toast.error("Opslaan mislukt")
    } finally {
      setSavingName(false)
    }
  }

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error("Vul een email in")
      return
    }

    setEmailSending(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() })
      if (error) {
        toast.error(error.message)
        return
      }
      setEmailSent(true)
      toast.success("Bevestigingsmail verstuurd")
    } catch (err) {
      console.error(err)
      toast.error("Er ging iets mis")
    } finally {
      setEmailSending(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  if (profile === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (profile === null) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Niet ingelogd.</p>
          <Link href="/">
            <Button>Ga naar de welkomstpagina</Button>
          </Link>
        </div>
      </main>
    )
  }

  const hasEmail = profile.email !== null && profile.email !== ""

  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" /> Terug
          </Link>
        </div>

        <header className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-1">
            Mijn profiel
          </h1>
          <p className="text-muted-foreground text-sm">
            Rol: <span className="font-medium text-foreground">{roleLabel(profile.role)}</span>
          </p>
        </header>

        {/* Naam */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Naam</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Hoe moet je getoond worden?</Label>
              <Input
                id="profile-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-11"
              />
            </div>
            <Button
              onClick={handleSaveName}
              disabled={savingName || editName.trim() === profile.name}
              className="gap-2"
            >
              {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Opslaan
            </Button>
          </CardContent>
        </Card>

        {/* Email voor cross-device */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email voor cross-device login</CardTitle>
            <CardDescription>
              {hasEmail
                ? "Je hebt een email gekoppeld — je kan op elk apparaat inloggen met deze email."
                : "Koppel een email zodat je op een ander apparaat kunt inloggen met dezelfde gegevens. Optioneel."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasEmail ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="font-medium">{profile.email}</span>
              </div>
            ) : emailSent ? (
              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                We hebben een bevestigingslink naar <strong className="text-foreground">{email}</strong> gestuurd.
                Klik die link om de koppeling af te ronden.
              </div>
            ) : !showEmailField ? (
              <Button
                variant="outline"
                onClick={() => setShowEmailField(true)}
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                Email koppelen
              </Button>
            ) : (
              <form onSubmit={handleAddEmail} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Je email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    placeholder="naam@voorbeeld.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={emailSending} className="gap-2">
                    {emailSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    Verstuur bevestiging
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowEmailField(false)}
                  >
                    Annuleer
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Uitloggen */}
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              Uitloggen
            </Button>
          </CardContent>
        </Card>
      </div>

      <Navigation />
    </main>
  )
}

function roleLabel(role: string): string {
  switch (role) {
    case "guest": return "Gast"
    case "vip": return "VIP-gast"
    case "ceremony_master": return "Ceremoniemeester"
    case "admin": return "Beheerder"
    default: return role
  }
}
