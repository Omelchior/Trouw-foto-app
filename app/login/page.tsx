"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mail, Lock, Loader2, CheckCircle2, ChevronLeft } from "lucide-react"
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

type Mode = "otp" | "password"

function LoginContent() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("otp")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return toast.error("Vul je email in")

    setIsLoading(true)
    const supabase = createClient()
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "")

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${siteUrl}/auth/callback` },
      })
      if (error) {
        toast.error(error.message)
        return
      }
      setIsSent(true)
    } catch (err) {
      console.error(err)
      toast.error("Er ging iets mis")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return toast.error("Vul email en wachtwoord in")

    setIsLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        toast.error("Inloggen mislukt — controleer email en wachtwoord")
        return
      }
      toast.success("Ingelogd")
      router.push("/")
    } catch (err) {
      console.error(err)
      toast.error("Er ging iets mis")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            {isSent ? (
              <CheckCircle2 className="w-6 h-6 text-primary" />
            ) : mode === "password" ? (
              <Lock className="w-6 h-6 text-primary" />
            ) : (
              <Mail className="w-6 h-6 text-primary" />
            )}
          </div>
          <CardTitle className="font-serif text-2xl">
            {isSent ? "Check je inbox" : "Inloggen"}
          </CardTitle>
          <CardDescription>
            {isSent
              ? `We hebben een login-link gestuurd naar ${email}`
              : mode === "password"
                ? "Voor ceremoniemeesters en beheerders"
                : "Ontvang een login-link via email"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isSent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Klik op de link in je email om in te loggen. De link is 1 uur
                  geldig. Check ook je spam folder.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsSent(false)
                  setEmail("")
                }}
                className="w-full h-12 bg-transparent"
              >
                Ander email adres gebruiken
              </Button>
            </div>
          ) : mode === "password" ? (
            <form onSubmit={handlePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="naam@voorbeeld.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-pw">Wachtwoord</Label>
                <Input
                  id="login-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inloggen...
                  </>
                ) : (
                  "Inloggen"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setMode("otp")}
                className="w-full text-sm text-muted-foreground underline underline-offset-2"
              >
                Terug naar login met email-link
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email-otp">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login-email-otp"
                    type="email"
                    placeholder="naam@voorbeeld.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Versturen...
                  </>
                ) : (
                  "Verstuur login-link"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setMode("password")}
                className="w-full text-sm text-muted-foreground underline underline-offset-2"
              >
                Ceremoniemeester of beheerder? Log in met wachtwoord
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" /> Terug naar de app
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
