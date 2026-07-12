"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { User, Loader2, LogOut, ChevronLeft, Save, Crown, Smartphone, Shield, ChevronRight } from "lucide-react"
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
          {profile.label && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Crown className="w-3.5 h-3.5" />
              {profile.label}
            </span>
          )}
        </header>

        {/* Beheer-ingang voor admins / ceremoniemeesters */}
        {(profile.role === "admin" || profile.role === "ceremony_master") && (
          <Link href="/admin" className="block">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Naar het beheer</p>
                  <p className="text-xs text-muted-foreground">
                    Beheer dashboard (vraagt om het beheer-wachtwoord)
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        )}

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

        {/* Cross-device uitleg */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inloggen op een ander apparaat</CardTitle>
            <CardDescription>
              Dat hoef je niet apart te regelen. Kies op elk apparaat gewoon
              opnieuw je naam op de startpagina en je komt automatisch terug in
              dit account, met je eigen foto&apos;s en opdrachten-voortgang.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="w-5 h-5 text-primary" />
              <span>Je naam is je login.</span>
            </div>
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
    case "fotograaf": return "Fotograaf"
    case "ceremony_master": return "Ceremoniemeester"
    case "admin": return "Beheerder"
    default: return role
  }
}
