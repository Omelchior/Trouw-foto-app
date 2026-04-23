"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MessageCircleQuestion, Lock, Check, Loader2, LogOut, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { QaEntry } from "@/components/qa-feed"

function formatTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) {
    return `Vandaag ${d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`
  }
  return d.toLocaleDateString("nl-NL", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function CeremoniemeesterPage() {
  const [entries, setEntries] = useState<QaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<"open" | "beantwoord" | "alle">("open")

  const load = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("qa_questions")
      .select("id, guest_name, question, is_secret, answer, answered_at, created_at")
      .order("created_at", { ascending: false })
    if (error) {
      console.error(error)
      toast.error("Kon vragen niet laden")
    } else {
      setEntries((data || []) as QaEntry[])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()

    const supabase = createClient()
    const channel = supabase
      .channel("cm-qa-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_questions" },
        () => load()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleAnswer = async (id: string) => {
    const answer = (answers[id] || "").trim()
    if (!answer) {
      toast.error("Voer een antwoord in")
      return
    }
    setSubmitting((s) => ({ ...s, [id]: true }))
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("qa_questions")
      .update({
        answer,
        answered_by: user?.id,
        answered_at: new Date().toISOString(),
      })
      .eq("id", id)

    setSubmitting((s) => ({ ...s, [id]: false }))

    if (error) {
      console.error(error)
      toast.error("Antwoorden mislukt")
      return
    }

    setAnswers((a) => { const n = { ...a }; delete n[id]; return n })
    toast.success("Antwoord geplaatst")
    load()
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/ceremoniemeester/login"
  }

  const filtered = entries.filter((e) => {
    if (filter === "open") return !e.answer
    if (filter === "beantwoord") return !!e.answer
    return true
  })

  return (
    <main className="min-h-screen pb-12 bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl font-bold">Ceremoniemeester</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vragen van de gasten — inclusief geheime.
            </p>
          </div>
          <Button variant="ghost" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" /> Uitloggen
          </Button>
        </div>

        <div className="flex gap-2 mb-6 border-b border-border">
          {(["open", "beantwoord", "alle"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                filter === f
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "open" && `Open (${entries.filter(e => !e.answer).length})`}
              {f === "beantwoord" && `Beantwoord (${entries.filter(e => !!e.answer).length})`}
              {f === "alle" && `Alle (${entries.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <MessageCircleQuestion className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {filter === "open" ? "Geen openstaande vragen 🎉" : "Geen vragen hier"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => (
              <Card
                key={e.id}
                className={cn(e.is_secret && "border-amber-500/40 bg-amber-500/5")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{e.guest_name}</span>
                    <span>{formatTime(e.created_at)}</span>
                  </div>

                  {e.is_secret && (
                    <div className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5 mb-2">
                      <Lock className="w-3 h-3" /> Geheim voor bruidspaar
                    </div>
                  )}

                  <p className="text-sm mb-3 whitespace-pre-wrap">{e.question}</p>

                  {e.answer ? (
                    <div className="pl-3 border-l-2 border-primary/40 bg-primary/5 rounded-r-md py-2 pr-3">
                      <div className="flex items-center gap-1 text-xs font-medium text-primary mb-1">
                        <Check className="w-3 h-3" /> Antwoord
                        {e.answered_at && (
                          <span className="text-muted-foreground font-normal">• {formatTime(e.answered_at)}</span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{e.answer}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={answers[e.id] || ""}
                        onChange={(ev) => setAnswers((a) => ({ ...a, [e.id]: ev.target.value }))}
                        placeholder="Typ hier je antwoord..."
                        rows={3}
                        className="resize-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAnswer(e.id)}
                        disabled={submitting[e.id] || !(answers[e.id] || "").trim()}
                        className="gap-2"
                      >
                        {submitting[e.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Verstuur antwoord
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Terug naar de gast-app
          </Link>
        </div>
      </div>
    </main>
  )
}
