"use client"

import { useState, useEffect } from "react"
import { MessageCircleQuestion, Loader2 } from "lucide-react"
import { QaForm } from "@/components/qa-form"
import { QaFeed, type QaEntry } from "@/components/qa-feed"
import { Navigation } from "@/components/navigation"
import { AdminAccessButton } from "@/components/admin-access-button"
import { createClient } from "@/lib/supabase/client"

export default function QaPage() {
  const [entries, setEntries] = useState<QaEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchEntries = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("qa_questions")
      .select("id, guest_name, question, is_secret, answer, answered_at, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching Q&A:", error)
    } else {
      setEntries((data || []) as QaEntry[])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchEntries()

    const supabase = createClient()
    const channel = supabase
      .channel("qa-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_questions" },
        () => fetchEntries()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <main className="min-h-screen pb-24">
      <div className="absolute top-4 right-4 z-10">
        <AdminAccessButton />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <MessageCircleQuestion className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Vragen
          </h1>
          <p className="text-muted-foreground">
            Stel een vraag aan de ceremoniemeesters. Zij beantwoorden hem zo snel mogelijk.
          </p>
        </header>

        <div className="mb-8">
          <QaForm onSubmitSuccess={fetchEntries} />
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-background text-sm text-muted-foreground">
              Vragen &amp; antwoorden
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <QaFeed entries={entries} />
        )}
      </div>

      <Navigation />
    </main>
  )
}
