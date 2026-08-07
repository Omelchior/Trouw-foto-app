"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Camera, UserRound, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { berekenActieveOpdracht, zetOpdrachtTekst } from "@/lib/guest"
import { useOpdrachten } from "@/components/opdrachten-provider"
import { toast } from "sonner"

interface GuestRow {
  name: string
  eerste_opdracht: number | null
  claimed_user_id: string | null
}

interface ProfileRow {
  user_id: string
  completed_challenges: number[] | null
  huidige_opdracht: number | null
}

interface PhotoRow {
  challenge_id: number | null
  uploaded_by: string | null
  user_id: string | null
}

/**
 * Beheeroverzicht per foto-opdracht: bewerk de tekst, zie wie 'm nu open heeft
 * staan (de actieve opdracht van die gast) en wie 'm al gedaan heeft.
 */
export function OpdrachtenOverzicht() {
  const opdrachten = useOpdrachten()
  const [guests, setGuests] = useState<GuestRow[] | "loading">("loading")
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [photos, setPhotos] = useState<PhotoRow[]>([])

  // Tekst bewerken.
  const [editId, setEditId] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [saving, setSaving] = useState(false)

  const laden = async () => {
    const supabase = createClient()
    const [g, pr, ph] = await Promise.all([
      supabase.from("guests").select("name, eerste_opdracht, claimed_user_id"),
      supabase.from("user_profiles").select("user_id, completed_challenges, huidige_opdracht"),
      supabase
        .from("photos")
        .select("challenge_id, uploaded_by, user_id")
        .not("challenge_id", "is", null),
    ])
    setGuests((g.data as GuestRow[]) ?? [])
    setProfiles((pr.data as ProfileRow[]) ?? [])
    setPhotos((ph.data as PhotoRow[]) ?? [])
  }

  useEffect(() => {
    laden()

    const supabase = createClient()
    const kanalen = ["photos", "user_profiles", "guests"].map((tabel) =>
      supabase
        .channel(`overzicht-${tabel}-changes`)
        .on("postgres_changes", { event: "*", schema: "public", table: tabel }, () => laden())
        .subscribe()
    )
    return () => {
      kanalen.forEach((k) => supabase.removeChannel(k))
    }
  }, [])

  const startBewerken = (id: number, tekst: string) => {
    setEditId(id)
    setEditText(tekst)
  }

  const annuleer = () => {
    setEditId(null)
    setEditText("")
  }

  const bewaar = async (id: number) => {
    const tekst = editText.trim()
    if (!tekst) {
      toast.error("Tekst mag niet leeg zijn")
      return
    }
    setSaving(true)
    try {
      await zetOpdrachtTekst(id, tekst)
      toast.success(`Opdracht #${id} bijgewerkt`)
      annuleer()
      // De provider vangt de wijziging via realtime op en ververst de teksten.
    } catch (e) {
      console.error("Tekst opslaan mislukt", e)
      toast.error("Opslaan mislukt, probeer het opnieuw")
    } finally {
      setSaving(false)
    }
  }

  // Per opdracht: gasten die 'm nu open hebben staan + gasten die 'm al deden.
  const perOpdracht = useMemo(() => {
    const gastenLijst = guests === "loading" ? [] : guests

    const profielPer = new Map<string, ProfileRow>()
    for (const p of profiles) profielPer.set(p.user_id, p)

    // De opdracht die elke gast nu open heeft staan (via zijn profiel).
    const moetDoen = new Map<number, string[]>()
    for (const g of gastenLijst) {
      const prof = g.claimed_user_id ? profielPer.get(g.claimed_user_id) : undefined
      const actief = berekenActieveOpdracht(
        g.eerste_opdracht,
        prof?.completed_challenges ?? [],
        prof?.huidige_opdracht ?? null,
      )
      if (actief == null) continue
      const lijst = moetDoen.get(actief) ?? []
      lijst.push(g.name)
      moetDoen.set(actief, lijst)
    }

    // Ontdubbel per opdracht op gast (user_id, val terug op naam).
    const gedaan = new Map<number, Map<string, string>>()
    for (const p of photos) {
      if (p.challenge_id == null) continue
      const key = p.user_id ?? p.uploaded_by ?? ""
      if (!key) continue
      const map = gedaan.get(p.challenge_id) ?? new Map<string, string>()
      if (!map.has(key)) map.set(key, p.uploaded_by ?? "Onbekend")
      gedaan.set(p.challenge_id, map)
    }

    return { moetDoen, gedaan }
  }, [guests, profiles, photos])

  if (guests === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  const { moetDoen, gedaan } = perOpdracht
  const rijen = opdrachten.map((c) => ({
    ...c,
    moetDoen: (moetDoen.get(c.id) ?? []).slice().sort((a, b) => a.localeCompare(b)),
    alGedaan: [...(gedaan.get(c.id)?.values() ?? [])].sort((a, b) => a.localeCompare(b)),
  }))
  const aantalGedaan = rijen.filter((r) => r.alGedaan.length > 0).length
  const totaalFotos = photos.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{aantalGedaan}</strong> / {opdrachten.length} opdrachten
          minstens één keer gedaan
        </span>
        <span>
          <strong className="text-foreground">{totaalFotos}</strong> opdracht-foto&apos;s in totaal
        </span>
      </div>

      <div className="space-y-2">
        {rijen.map((r) => (
          <div
            key={r.id}
            className="border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-start gap-3 bg-card"
          >
            <div className="flex items-start gap-3 sm:w-2/5">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs shrink-0">
                {r.id}
              </div>
              {editId === r.id ? (
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => bewaar(r.id)} disabled={saving} className="gap-1 h-8">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Opslaan
                    </Button>
                    <Button size="sm" variant="outline" onClick={annuleer} disabled={saving} className="gap-1 h-8">
                      <X className="w-3.5 h-3.5" />
                      Annuleer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-start gap-1.5">
                  <p className="text-sm text-foreground leading-snug flex-1">{r.text}</p>
                  <button
                    onClick={() => startBewerken(r.id, r.text)}
                    aria-label={`Tekst van opdracht ${r.id} bewerken`}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:pl-3 sm:border-l sm:border-border">
              {/* Heeft 'm nu open staan */}
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  <UserRound className="w-3.5 h-3.5" />
                  Moet doen ({r.moetDoen.length})
                </p>
                {r.moetDoen.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70">Niemand</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {r.moetDoen.map((naam) => (
                      <span
                        key={naam}
                        className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                      >
                        {naam}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Al gedaan */}
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  <Camera className="w-3.5 h-3.5" />
                  Al gedaan ({r.alGedaan.length})
                </p>
                {r.alGedaan.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70">Nog niemand</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {r.alGedaan.map((naam) => (
                      <span
                        key={naam}
                        className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-foreground"
                      >
                        {naam}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
