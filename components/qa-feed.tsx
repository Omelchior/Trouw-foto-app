"use client"

import { MessageCircle, Lock, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface QaEntry {
  id: string
  guest_name: string
  question: string
  is_secret: boolean
  answer: string | null
  answered_at: string | null
  created_at: string
}

interface QaFeedProps {
  entries: QaEntry[]
  emptyText?: string
  showSecretBadge?: boolean
}

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

export function QaFeed({ entries, emptyText, showSecretBadge }: QaFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
          <MessageCircle className="w-10 h-10 text-muted-foreground" />
        </div>
        <p className="text-lg text-muted-foreground">
          {emptyText ?? "Nog geen vragen"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div
          key={e.id}
          className={cn(
            "rounded-lg border bg-card p-4 transition-colors",
            e.is_secret && "border-amber-500/40 bg-amber-500/5",
          )}
        >
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{e.guest_name}</span>
            <span>{formatTime(e.created_at)}</span>
          </div>

          {showSecretBadge && e.is_secret && (
            <div className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5 mb-2">
              <Lock className="w-3 h-3" /> Geheim voor bruidspaar
            </div>
          )}

          <p className="text-sm text-foreground whitespace-pre-wrap">{e.question}</p>

          {e.answer ? (
            <div className="mt-3 pl-3 border-l-2 border-primary/40 bg-primary/5 rounded-r-md py-2 pr-3">
              <div className="flex items-center gap-1 text-xs font-medium text-primary mb-1">
                <Check className="w-3 h-3" /> Antwoord van de ceremoniemeester
                {e.answered_at && (
                  <span className="text-muted-foreground font-normal">• {formatTime(e.answered_at)}</span>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{e.answer}</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground italic">Nog niet beantwoord</p>
          )}
        </div>
      ))}
    </div>
  )
}
