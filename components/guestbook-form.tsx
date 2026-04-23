"use client"

import React, { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { getCurrentProfile } from "@/lib/guest"

interface GuestbookFormProps {
  onSubmitSuccess?: () => void
}

export function GuestbookForm({ onSubmitSuccess }: GuestbookFormProps) {
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-fill name from current profile
  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (p?.name) setName(p.name)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !message.trim()) {
      toast.error("Vul alle velden in")
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("guestbook_entries")
        .insert({ guest_name: name.trim(), message: message.trim() })

      if (error) throw error

      toast.success("Bedankt voor je bericht! 💌")
      setMessage("")
      onSubmitSuccess?.()
    } catch (error) {
      console.error("Guestbook error:", error)
      toast.error("Er ging iets mis")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="guestbook-name">Je naam</Label>
        <Input
          id="guestbook-name"
          placeholder="Je naam"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guestbook-message">Je bericht</Label>
        <Textarea
          id="guestbook-message"
          placeholder="Schrijf een lieve boodschap voor het bruidspaar..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="resize-none"
        />
      </div>
      <Button
        type="submit"
        disabled={isSubmitting || !name.trim() || !message.trim()}
        className="w-full h-12"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verzenden...
          </>
        ) : (
          "Plaats bericht 💌"
        )}
      </Button>
    </form>
  )
}
