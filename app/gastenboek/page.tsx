"use client"

import { useState, useEffect } from "react"
import { MessageCircle, Loader2 } from "lucide-react"
import { GuestbookForm } from "@/components/guestbook-form"
import { GuestbookFeed } from "@/components/guestbook-feed"
import { Navigation } from "@/components/navigation"
import { createClient } from "@/lib/supabase/client"

interface GuestbookEntry {
  id: string
  guest_name: string
  message: string
  created_at: string
}

export default function GastenboekPage() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchEntries = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("guestbook_entries")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching guestbook:", error)
    } else {
      setEntries(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchEntries()
    
    // Set up realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel("guestbook-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guestbook_entries" },
        () => {
          fetchEntries()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <main className="min-h-screen pb-20">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <MessageCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Gastenboek
          </h1>
          <p className="text-muted-foreground">
            Laat een bericht achter voor het bruidspaar
          </p>
        </header>

        {/* Form */}
        <div className="mb-8">
          <GuestbookForm onSubmitSuccess={fetchEntries} />
        </div>

        {/* Divider */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-background text-sm text-muted-foreground">
              Berichten
            </span>
          </div>
        </div>

        {/* Feed */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <GuestbookFeed entries={entries} />
        )}
      </div>

      <Navigation />
    </main>
  )
}
