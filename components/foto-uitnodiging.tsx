"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Aperture, Camera, ChevronRight, Images, MonitorPlay, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { isFotograafItem, isVideoItem, isVrijgegevenFotograaf, metUrls } from "@/lib/media"

interface Foto {
  id: string
  storage_path: string
  thumb_pad?: string | null
  uploaded_by: string
  user_id?: string | null
  media_type?: string | null
  bron?: string | null
  zichtbaar_dag?: boolean
  zichtbaar_avond?: boolean
  url: string
  thumb_url: string
}

/** Zoveel willekeurige foto's in het mozaïek en bij de fotograaf. */
const MOZAIEK = 3

/**
 * Kies n willekeurige foto's, maar houd een eerdere keuze vast zolang die nog
 * bestaat: anders springen de foto's om bij elke nieuwe upload van een ander.
 */
function willekeurig<T extends { id: string }>(lijst: T[], n: number, vorige: string[]): T[] {
  const perId = new Map(lijst.map((f) => [f.id, f]))
  const behouden = vorige.map((id) => perId.get(id)).filter((f): f is T => !!f)
  if (behouden.length >= Math.min(n, lijst.length)) return behouden.slice(0, n)
  const rest = lijst.filter((f) => !vorige.includes(f.id))
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return [...behouden, ...rest].slice(0, n)
}

/**
 * Homepage na de bruiloft: lokt uit om foto's te delen en om ze te bekijken.
 * Een grote upload-knop (met een duwtje als je zelf nog niets deelde), een
 * voorproefje van de foto's van de fotograaf (alleen daggasten; de database
 * geeft ze anderen niet mee) en een paar willekeurige foto's met de weg naar galerij en
 * diavoorstelling. Bewust compact: op een telefoon past alles in één scherm.
 */
export function FotoUitnodiging({ userId }: { userId: string }) {
  const [fotos, setFotos] = useState<Foto[] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let actief = true
    const laden = async () => {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .order("uploaded_at", { ascending: false })
      if (!actief) return
      if (error) {
        console.error("Foto's ophalen mislukt", error)
        setFotos([])
        return
      }
      setFotos((data ?? []).map((p) => metUrls(supabase, p as Omit<Foto, "url" | "thumb_url">)))
    }
    laden()

    // Nieuwe uploads van anderen verschijnen vanzelf (gebundeld herladen).
    let timer: ReturnType<typeof setTimeout> | null = null
    const kanaal = supabase
      .channel("home-fotos")
      .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(laden, 1500)
      })
      .subscribe()
    return () => {
      actief = false
      if (timer) clearTimeout(timer)
      supabase.removeChannel(kanaal)
    }
  }, [])

  const gast = (fotos ?? []).filter((f) => !isFotograafItem(f))
  const fotograaf = (fotos ?? []).filter((f) => isVrijgegevenFotograaf(f))
  const eigen = gast.filter((f) => f.user_id === userId).length
  const delers = new Set(gast.map((f) => f.uploaded_by)).size
  // Willekeurige foto's i.p.v. de nieuwste: zo komt telkens iets anders voorbij.
  const gekozenGast = useRef<string[]>([])
  const gekozenFotograaf = useRef<string[]>([])
  const mozaiek = willekeurig(gast.filter((f) => !isVideoItem(f)), MOZAIEK, gekozenGast.current)
  gekozenGast.current = mozaiek.map((f) => f.id)
  const fotograafUitgelicht = willekeurig(fotograaf, MOZAIEK, gekozenFotograaf.current)
  gekozenFotograaf.current = fotograafUitgelicht.map((f) => f.id)
  const meer = gast.length - mozaiek.length

  return (
    <div className="space-y-3">
      {/* Uploaden: de hoofdactie */}
      <section className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-5 shadow-lg">
        <Sparkles className="absolute -right-3 -top-3 w-20 h-20 opacity-15" aria-hidden />
        <div className="relative space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-bold leading-tight">
                {eigen === 0 ? "Heb jij nog foto's op je telefoon?" : "Nog meer moois op je telefoon?"}
              </h2>
              <p className="mt-0.5 text-sm text-primary-foreground/85">
                {eigen === 0
                  ? "Deel je kiekjes en filmpjes, dan beleeft iedereen de dag nog eens."
                  : `Jij deelde er al ${eigen} — top! Voeg gerust de rest toe.`}
              </p>
            </div>
          </div>
          <Button asChild size="lg" variant="secondary" className="w-full h-12 text-base gap-2">
            <Link href="/selectie?upload=1">
              <Camera className="w-5 h-5" />
              Foto&apos;s &amp; video&apos;s delen
            </Link>
          </Button>
        </div>
      </section>

      {/* De fotograaf: alleen zichtbaar voor wie ze mag zien */}
      {fotograaf.length > 0 && (
        <Link
          href="/selectie?tab=fotograaf"
          className="block rounded-2xl border border-border bg-card p-3 space-y-2.5 hover:bg-muted/60 transition-colors"
        >
          <div className="flex items-center gap-2 px-1">
            <Aperture className="w-4 h-4 text-primary shrink-0" />
            <p className="flex-1 min-w-0 font-medium text-foreground truncate">
              Foto&apos;s van de fotograaf{" "}
              <span className="text-muted-foreground font-normal">({fotograaf.length})</span>
            </p>
            <span className="inline-flex items-center text-sm font-medium text-primary shrink-0">
              Bekijk <ChevronRight className="w-4 h-4" />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {fotograafUitgelicht.map((f) => (
              <img
                key={f.id}
                src={f.thumb_url}
                alt=""
                loading="lazy"
                className="aspect-square w-full object-cover rounded-lg bg-muted"
              />
            ))}
          </div>
        </Link>
      )}

      {/* Bekijken: willekeurige foto's, galerij en diavoorstelling */}
      <section className="rounded-2xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <p className="font-serif text-lg font-bold text-foreground">Bekijk alle foto&apos;s</p>
          {gast.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {gast.length} van {delers} {delers === 1 ? "gast" : "gasten"}
            </p>
          )}
        </div>
        {mozaiek.length > 0 && (
          <Link href="/selectie" className="grid grid-cols-3 gap-1.5" aria-label="Naar de galerij">
            {mozaiek.map((f, i) => (
              <div key={f.id} className="relative aspect-square">
                <img
                  src={f.thumb_url}
                  alt={`Foto van ${f.uploaded_by}`}
                  loading="lazy"
                  className="w-full h-full object-cover rounded-lg bg-muted"
                />
                {i === mozaiek.length - 1 && meer > 0 && (
                  <div className="absolute inset-0 rounded-lg bg-foreground/55 flex items-center justify-center text-white font-bold text-lg">
                    +{meer}
                  </div>
                )}
              </div>
            ))}
          </Link>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-11 gap-2">
            <Link href="/selectie">
              <Images className="w-4 h-4" />
              Galerij
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 gap-2">
            <Link href="/diavoorstelling">
              <MonitorPlay className="w-4 h-4" />
              Diavoorstelling
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
