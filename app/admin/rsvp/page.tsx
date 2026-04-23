"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, Loader2, Trash2, ChevronLeft, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface RsvpRow {
  id: string
  guest_name: string
  email: string
  attending: boolean
  party_size: number
  created_at: string
}

export default function AdminRsvpPage() {
  const [rows, setRows] = useState<RsvpRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("rsvp_responses")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) {
      console.error(error)
      toast.error("Kon RSVP-lijst niet laden")
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("rsvp_responses").delete().eq("id", id)
    if (error) {
      toast.error("Verwijderen mislukt")
      return
    }
    setRows(rs => rs.filter(r => r.id !== id))
    toast.success("Verwijderd")
  }

  const yes = rows.filter(r => r.attending)
  const no = rows.filter(r => !r.attending)
  const totalPeople = yes.reduce((acc, r) => acc + r.party_size, 0)

  return (
    <main className="min-h-screen pb-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Admin dashboard
        </Link>

        <header className="mb-6">
          <h1 className="font-serif text-3xl font-bold">RSVP overzicht</h1>
          <p className="text-muted-foreground text-sm mt-1">Aanmeldingen voor de bruiloft.</p>
        </header>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">Totale aanmeldingen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1">
                <Heart className="w-3 h-3 text-primary" /> Ja
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{yes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <Users className="inline w-3 h-3 mr-1" />
                {totalPeople} personen totaal
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">Helaas niet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{no.length}</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nog geen aanmeldingen</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{r.guest_name}</p>
                      <span
                        className={
                          r.attending
                            ? "text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                            : "text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                        }
                      >
                        {r.attending ? `Ja • ${r.party_size}p` : "Niet"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{r.email}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(r.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
