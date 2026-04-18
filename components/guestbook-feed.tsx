"use client"

import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { MessageCircle, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface GuestbookEntry {
  id: string
  guest_name: string
  message: string
  created_at: string
}

interface GuestbookFeedProps {
  entries: GuestbookEntry[]
  isAdmin?: boolean
  onDelete?: (id: string) => void
}

export function GuestbookFeed({ entries, isAdmin = false, onDelete }: GuestbookFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Nog geen berichten. Wees de eerste!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <Card key={entry.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-serif text-lg font-semibold">{entry.guest_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.created_at), { 
                      addSuffix: true, 
                      locale: nl 
                    })}
                  </span>
                </div>
                <p className="text-foreground whitespace-pre-wrap">{entry.message}</p>
              </div>
              {isAdmin && onDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
