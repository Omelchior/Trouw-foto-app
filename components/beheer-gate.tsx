"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Lock, ChevronLeft } from "lucide-react"
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
import { toast } from "sonner"

interface BeheerGateProps {
  target: string
  title: string
}

/**
 * Password gate for the beheer areas. The guest is already logged in (via name);
 * this only unlocks the protected /admin or /ceremoniemeester section.
 */
export function BeheerGate({ target, title }: BeheerGateProps) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      toast.error("Vul het wachtwoord in")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/beheer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? "Onjuist wachtwoord")
        return
      }
      toast.success("Beheer ontgrendeld")
      router.push(target)
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error("Er ging iets mis")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="font-serif text-2xl">{title}</CardTitle>
          <CardDescription>
            Voer het beheer-wachtwoord in om verder te gaan. Zorg dat je eerst
            via de startpagina met je naam bent ingelogd.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="beheer-pw">Wachtwoord</Label>
              <Input
                id="beheer-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                autoComplete="current-password"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ontgrendelen...
                </>
              ) : (
                "Ontgrendel beheer"
              )}
            </Button>
          </form>

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
