"use client"

import React, { useEffect, useState } from "react"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { getCurrentProfile, createGuestSession } from "@/lib/guest"

interface QaFormProps {
  onSubmitSuccess?: () => void
}

export function QaForm({ onSubmitSuccess }: QaFormProps) {
  const [name, setName] = useState("")
  const [question, setQuestion] = useState("")
  const [isSecret, setIsSecret] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (p?.name) setName(p.name)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !question.trim()) {
      toast.error("Vul je naam en je vraag in")
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // Ensure a session exists (anonymous) so user_id is available for insert
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        await createGuestSession(name)
        const resp = await supabase.auth.getUser()
        user = resp.data.user
      }
      if (!user) throw new Error("Geen sessie")

      const { error } = await supabase.from("qa_questions").insert({
        user_id: user.id,
        guest_name: name.trim(),
        question: question.trim(),
        is_secret: isSecret,
      })

      if (error) throw error

      toast.success(isSecret ? "Vraag verstuurd naar de ceremoniemeesters 🔒" : "Vraag geplaatst 💭")
      setQuestion("")
      setIsSecret(false)
      onSubmitSuccess?.()
    } catch (err) {
      console.error(err)
      toast.error("Er ging iets mis")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="qa-name">Je naam</Label>
        <Input
          id="qa-name"
          placeholder="Je naam"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="qa-question">Je vraag</Label>
        <Textarea
          id="qa-question"
          placeholder="Waar wil je meer over weten, of wat wil je aan de ceremoniemeester vragen?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          className="resize-none"
        />
      </div>

      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isSecret}
          onChange={(e) => setIsSecret(e.target.checked)}
          className="mt-1 accent-primary w-4 h-4"
        />
        <span className="text-sm text-muted-foreground leading-snug">
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Lock className="w-3 h-3" /> Geheim voor het bruidspaar
          </span>
          <br />
          Alleen ceremoniemeesters zien deze vraag (bv. voor een verrassing).
        </span>
      </label>

      <Button
        type="submit"
        disabled={isSubmitting || !name.trim() || !question.trim()}
        className="w-full h-12"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Versturen...
          </>
        ) : (
          "Plaats vraag 💭"
        )}
      </Button>
    </form>
  )
}
