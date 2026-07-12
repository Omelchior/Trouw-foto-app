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
