"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Armchair, UtensilsCrossed } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface TafelGast {
  id: string
  slug: string
  name: string
  dagdeel: "dag" | "avond" | null
  tafel: number | null
  stoel: number | null
  dieetwensen: string | null
}

const TAFELS = [1, 2, 3, 4, 5]

// Opstelling als een dobbelsteen met 5 ogen (3x3 grid):
// tafel 1 linksboven, 3 rechtsboven, 2 in het midden, 4 linksonder, 5 rechtsonder.
const DOBBELSTEEN_POSITIE: Record<number, string> = {
  1: "col-start-1 row-start-1",
  3: "col-start-3 row-start-1",
  2: "col-start-2 row-start-2",
  4: "col-start-1 row-start-3",
  5: "col-start-3 row-start-3",
}

/** Eén ronde tafel; gasten als naamkaartjes eromheen, versleepbaar om te herschikken. */
function RondeTafel({
  nummer,
  leden,
  markeerDieet,
  sleepbaar,
  onHerschik,
}: {
  nummer: number
  leden: TafelGast[]
  markeerDieet: boolean
  sleepbaar: boolean
  onHerschik: (tafel: number, geordendeSlugs: string[]) => void
}) {
  const straal = 40 // afstand naamkaartjes tot het midden, in % van de cel
  const vlakRef = useRef<HTMLDivElement>(null)
  const [sleep, setSleep] = useState<{ slug: string; dx: number; dy: number } | null>(null)
  const start = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const beginSleep = (e: React.PointerEvent, slug: string) => {
    if (!sleepbaar || leden.length < 2) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    setSleep({ slug, dx: 0, dy: 0 })
  }

  const beweeg = (e: React.PointerEvent) => {
    if (!sleep) return
    setSleep({ ...sleep, dx: e.clientX - start.current.x, dy: e.clientY - start.current.y })
  }

  const eindig = (e: React.PointerEvent) => {
    if (!sleep) return
    const vlak = vlakRef.current
    const n = leden.length
    if (vlak && n > 1) {
      const r = vlak.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const hoek = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
      // Slot 0 staat bovenaan (-90°), met de klok mee.
      let doel = Math.round((hoek + 90) / (360 / n))
      doel = ((doel % n) + n) % n
      const order = leden.map((g) => g.slug)
      const from = order.indexOf(sleep.slug)
      if (from !== -1) {
        order.splice(from, 1)
        order.splice(Math.min(doel, order.length), 0, sleep.slug)
        if (order.some((s, i) => s !== leden[i].slug)) onHerschik(nummer, order)
      }
    }
    setSleep(null)
  }

  return (
    <div ref={vlakRef} className="relative aspect-square w-full">
      <div className="absolute left-1/2 top-1/2 flex aspect-square w-[46%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground">
        <span className="font-serif text-xl font-bold">{nummer}</span>
        <span className="text-[10px] opacity-80">
          {leden.length === 0 ? "leeg" : `${leden.length} gasten`}
        </span>
      </div>
      {leden.map((g, i) => {
        const hoek = ((-90 + (i * 360) / leden.length) * Math.PI) / 180
        const x = 50 + Math.cos(hoek) * straal
        const y = 50 + Math.sin(hoek) * straal
        const sleept = sleep?.slug === g.slug
        const heeftDieet = !!g.dieetwensen
        const gedimd = markeerDieet && !heeftDieet
        return (
          <span
            key={g.id}
            onPointerDown={(e) => beginSleep(e, g.slug)}
            onPointerMove={beweeg}
            onPointerUp={eindig}
            title={g.dieetwensen ? `${g.name} — ${g.dieetwensen}` : g.name}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) translate(${sleept ? sleep!.dx : 0}px, ${sleept ? sleep!.dy : 0}px)`,
              zIndex: sleept ? 30 : 10,
            }}
            className={[
              "absolute inline-flex items-center gap-1 whitespace-nowrap rounded border bg-background px-1.5 py-0.5 text-[11px] font-medium shadow-sm",
              sleepbaar ? "touch-none cursor-grab active:cursor-grabbing" : "",
              sleept ? "shadow-lg" : "",
              markeerDieet && heeftDieet ? "border-amber-500 ring-2 ring-amber-400/50" : "border-border",
              gedimd ? "opacity-30" : "",
            ].join(" ")}
          >
            {markeerDieet && heeftDieet && (
              <UtensilsCrossed className="w-3 h-3 text-amber-600 shrink-0" />
            )}
            {g.name}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Tafelindeling voor het diner: alle daggasten, gegroepeerd per tafel.
 * De tafel is per gast direct aan te passen met het dropdownmenu;
 * de positie aan tafel is aan te passen door de naamkaartjes te verslepen.
 */
export function TafelIndeling() {
  const [gasten, setGasten] = useState<TafelGast[] | "loading">("loading")
  const [markeerDieet, setMarkeerDieet] = useState(false)
  // Slepen kan alleen als de stoel-kolom (migratie 010) bestaat.
  const [heeftStoel, setHeeftStoel] = useState(true)

  const fetchGasten = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("guests")
      .select("id, slug, name, dagdeel, tafel, stoel, dieetwensen")
      .order("name")
    if (!error && data) {
      setGasten(data as TafelGast[])
      return
    }
    // Fallback zolang migratie 010 (stoel-kolom) nog niet is uitgevoerd.
    setHeeftStoel(false)
    const zonder = await supabase
      .from("guests")
      .select("id, slug, name, dagdeel, tafel, dieetwensen")
      .order("name")
    if (zonder.error || !zonder.data) {
      console.error(error, zonder.error)
      toast.error("Kon de tafelindeling niet laden")
      setGasten([])
      return
    }
    setGasten(zonder.data.map((g) => ({ ...g, stoel: null })) as TafelGast[])
  }

  useEffect(() => {
    fetchGasten()
  }, [])

  const dagGasten = useMemo(
    () => (gasten === "loading" ? [] : gasten.filter((g) => g.dagdeel === "dag")),
    [gasten],
  )

  const ledenVan = (t: number) =>
    dagGasten
      .filter((g) => g.tafel === t)
      .sort((a, b) => (a.stoel ?? 999) - (b.stoel ?? 999) || a.name.localeCompare(b.name))

  const zetTafel = async (g: TafelGast, tafel: number | null) => {
    const supabase = createClient()
    const { error } = await supabase.from("guests").update({ tafel, stoel: null }).eq("id", g.id)
    if (error) {
      console.error(error)
      toast.error("Tafel wijzigen mislukt")
      return
    }
    setGasten((prev) =>
      prev === "loading" ? prev : prev.map((row) => (row.id === g.id ? { ...row, tafel, stoel: null } : row)),
    )
  }

  const herschik = async (tafel: number, geordendeSlugs: string[]) => {
    // Optimistisch: nieuwe stoelnummers meteen tonen.
    setGasten((prev) =>
      prev === "loading"
        ? prev
        : prev.map((g) => {
            const idx = geordendeSlugs.indexOf(g.slug)
            return idx >= 0 && g.tafel === tafel ? { ...g, stoel: idx } : g
          }),
    )
    const supabase = createClient()
    const res = await Promise.all(
      geordendeSlugs.map((slug, i) => supabase.from("guests").update({ stoel: i }).eq("slug", slug)),
    )
    if (res.some((r) => r.error)) {
      console.error(res.map((r) => r.error).filter(Boolean))
      toast.error("Volgorde opslaan mislukt")
      fetchGasten()
    }
  }

  if (gasten === "loading") {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const zonderTafel = dagGasten.filter((g) => !g.tafel)
  const dieetGasten = dagGasten
    .filter((g) => g.dieetwensen)
    .sort((a, b) => (a.tafel ?? 99) - (b.tafel ?? 99) || a.name.localeCompare(b.name))

  const groepen: { tafel: number | null; titel: string; leden: TafelGast[] }[] = [
    ...TAFELS.map((t) => ({ tafel: t, titel: `Tafel ${t}`, leden: ledenVan(t) })),
    { tafel: null, titel: "Nog geen tafel", leden: zonderTafel },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {dagGasten.length} daggasten, {zonderTafel.length} nog zonder tafel.{" "}
          {heeftStoel
            ? "Sleep de naamkaartjes om ze aan tafel te herschikken."
            : "Voer migratie 010 uit om de plaatsen aan tafel te kunnen slepen."}{" "}
          Avondgasten staan hier niet bij.
        </p>
        <button
          type="button"
          onClick={() => setMarkeerDieet((v) => !v)}
          className={[
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            markeerDieet
              ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-border text-muted-foreground hover:bg-muted",
          ].join(" ")}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          Dieetwensen {markeerDieet ? "aan" : "uit"} ({dieetGasten.length})
        </button>
      </div>

      {/* Plattegrond: 5 ronde tafels als dobbelsteen-ogen, scherm bovenaan */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-border bg-card">
        <div className="min-w-[640px] space-y-4 p-6">
          <div className="mx-auto w-1/2 rounded bg-primary py-1.5 text-center text-xs font-semibold tracking-[0.3em] text-primary-foreground">
            SCHERM
          </div>
          <div className="grid grid-cols-3 grid-rows-3 gap-3">
            {TAFELS.map((t) => (
              <div key={t} className={DOBBELSTEEN_POSITIE[t]}>
                <RondeTafel
                  nummer={t}
                  leden={ledenVan(t)}
                  markeerDieet={markeerDieet}
                  sleepbaar={heeftStoel}
                  onHerschik={herschik}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dieetwensen-overzicht */}
      {markeerDieet && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
            <UtensilsCrossed className="w-4 h-4" /> Dieetwensen &amp; allergieën
          </div>
          {dieetGasten.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen dieetwensen bij de daggasten.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {dieetGasten.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{g.name}</span>
                    {g.tafel && <span className="text-muted-foreground"> · tafel {g.tafel}</span>}
                  </span>
                  <span className="text-amber-700 dark:text-amber-400">{g.dieetwensen}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {groepen.map((groep) => (
          <div key={groep.titel} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-medium">
                <Armchair className="w-4 h-4 text-primary" />
                {groep.titel}
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {groep.leden.length}
              </span>
            </div>
            {groep.leden.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nog niemand</p>
            ) : (
              <div className="space-y-1.5">
                {groep.leden.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm truncate">
                      {g.name}
                      {g.dieetwensen && (
                        <UtensilsCrossed
                          className="w-3 h-3 text-amber-600 shrink-0"
                          aria-label={g.dieetwensen}
                        />
                      )}
                    </span>
                    <select
                      value={g.tafel ?? ""}
                      onChange={(e) => zetTafel(g, e.target.value ? parseInt(e.target.value, 10) : null)}
                      className="h-7 rounded-md border border-input bg-background px-1 text-xs shrink-0"
                      title="Verplaats naar andere tafel"
                    >
                      <option value="">Geen</option>
                      {TAFELS.map((t) => (
                        <option key={t} value={t}>Tafel {t}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
