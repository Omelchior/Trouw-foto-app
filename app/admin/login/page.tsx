"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Lock, Loader2, Mail, CheckCircle2 } from "lucide-react"
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

export default function AdminLoginPage() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Vul je email adres in")
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setIsSent(true)
    } catch (error) {
      console.error("Magic link error:", error)
      toast.error("Er ging iets mis bij het versturen")
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
            ) : (
              <Lock className="w-6 h-6 text-primary" />
            )}
          </div>
          <CardTitle className="font-serif text-2xl">
            {isSent ? "Check je inbox" : "Admin Login"}
          </CardTitle>
          <CardDescription>
            {isSent
              ? `We hebben een login link gestuurd naar ${email}`
              : "Ontvang een login link via email"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorParam && !isSent && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              Inloggen mislukt. Probeer het opnieuw.
            </div>
          )}

          {isSent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Klik op de link in je email om in te loggen. Check ook je spam
                  folder als je de email niet ziet.
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
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Versturen...
                  </>
                ) : (
                  "Verstuur login link"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
