"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Armchair } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface TafelGast {
  id: string
  slug: string
  name: string
  dagdeel: "dag" | "avond" | null
  tafel: number | null
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

/** Eén ronde tafel met de gasten er als naamkaartjes omheen. */
function RondeTafel({ nummer, leden }: { nummer: number; leden: TafelGast[] }) {
  const straal = 40 // afstand naamkaartjes tot het midden, in % van de cel
  return (
    <div className="relative aspect-square w-full">
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
        return (
          <span
            key={g.id}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium shadow-sm"
          >
            {g.name}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Tafelindeling voor het diner: alle daggasten, gegroepeerd per tafel.
 * De tafel is per gast direct aan te passen met het dropdownmenu.
 */
export function TafelIndeling() {
  const [gasten, setGasten] = useState<TafelGast[] | "loading">("loading")

  const fetchGasten = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("guests")
      .select("id, slug, name, dagdeel, tafel")
      .order("name")
    if (error) {
      console.error(error)
      toast.error("Kon de tafelindeling niet laden (is migratie 009 al uitgevoerd?)")
      setGasten([])
      return
    }
    setGasten(data as TafelGast[])
  }

  useEffect(() => {
    fetchGasten()
  }, [])

  const dagGasten = useMemo(
    () => (gasten === "loading" ? [] : gasten.filter((g) => g.dagdeel === "dag")),
    [gasten],
  )

  const zetTafel = async (g: TafelGast, tafel: number | null) => {
    const supabase = createClient()
    const { error } = await supabase.from("guests").update({ tafel }).eq("id", g.id)
    if (error) {
      console.error(error)
      toast.error("Tafel wijzigen mislukt")
      return
    }
    setGasten((prev) =>
      prev === "loading" ? prev : prev.map((row) => (row.id === g.id ? { ...row, tafel } : row)),
    )
  }

  if (gasten === "loading") {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const zonderTafel = dagGasten.filter((g) => !g.tafel)

  const groepen: { titel: string; leden: TafelGast[] }[] = [
    ...TAFELS.map((t) => ({
      titel: `Tafel ${t}`,
      leden: dagGasten.filter((g) => g.tafel === t),
    })),
    { titel: "Nog geen tafel", leden: zonderTafel },
  ]

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        {dagGasten.length} daggasten, {zonderTafel.length} nog zonder tafel.
        Avondgasten staan hier niet bij.
      </p>

      {/* Plattegrond: 5 ronde tafels als dobbelsteen-ogen, scherm bovenaan */}
      <div className="mb-6 overflow-x-auto rounded-lg border border-border bg-card">
        <div className="min-w-[640px] space-y-4 p-6">
          <div className="mx-auto w-1/2 rounded bg-primary py-1.5 text-center text-xs font-semibold tracking-[0.3em] text-primary-foreground">
            SCHERM
          </div>
          <div className="grid grid-cols-3 grid-rows-3 gap-3">
            {TAFELS.map((t) => (
              <div key={t} className={DOBBELSTEEN_POSITIE[t]}>
                <RondeTafel nummer={t} leden={dagGasten.filter((g) => g.tafel === t)} />
              </div>
            ))}
          </div>
        </div>
      </div>

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
                    <span className="text-sm truncate">{g.name}</span>
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
