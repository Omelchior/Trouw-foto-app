"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Loader2, Mail, Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGithubLoading, setIsGithubLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !password.trim()) {
      toast.error("Vul alle velden in")
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      })

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Ongeldige inloggegevens")
        } else {
          toast.error(error.message)
        }
        return
      }

      toast.success("Ingelogd!")
      router.push("/admin")
    } catch (error) {
      console.error("Login error:", error)
      toast.error("Er ging iets mis")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGithubLogin = async () => {
    setIsGithubLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/admin`,
        },
      })

      if (error) {
        console.error("GitHub login error:", error)
        toast.error("GitHub inloggen mislukt")
      }
    } catch (error) {
      console.error("GitHub OAuth error:", error)
      toast.error("Er ging iets mis met GitHub inloggen")
    } finally {
      setIsGithubLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="font-serif text-2xl">Admin Login</CardTitle>
          <CardDescription>
            Log in om foto's te beheren en te selecteren
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              onClick={handleGithubLogin}
              disabled={isGithubLoading}
              variant="outline"
              className="w-full h-12 border-2 hover:bg-accent bg-transparent"
              aria-label="Log in with GitHub account"
            >
              {isGithubLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verbinden...
                </>
              ) : (
                <>
                  <Github className="w-4 h-4 mr-2" />
                  GitHub inloggen
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">
                  Of gebruik email
                </span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
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
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                    autoComplete="current-password"
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
                    Inloggen...
                  </>
                ) : (
                  "Inloggen"
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
