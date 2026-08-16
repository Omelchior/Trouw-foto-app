"use client"

import { useState } from "react"
import { Clock, PlayCircle, Power, Loader2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { effectiveOpen, APP_OPEN_TEKST, type OpenModus } from "@/lib/bruiloft"
import { useOpenModus, zetOpenModus } from "@/lib/app-status"
import { toast } from "sonner"

const OPTIES: { modus: OpenModus; label: string; uitleg: string; icon: LucideIcon }[] = [
  { modus: "auto", label: "Automatisch", uitleg: `Opent vanzelf om ${APP_OPEN_TEKST} op de trouwdag`, icon: Clock },
  { modus: "open", label: "Nu openen", uitleg: "Zet de app direct open voor alle gasten", icon: PlayCircle },
  { modus: "dicht", label: "Sluiten", uitleg: "Houd de app gesloten, ook na de trouwdag", icon: Power },
]

/**
 * Beheer-schakelaar voor de app-toegang. Drie standen (auto / nu open / dicht),
 * live gedeeld via realtime; werkt door in de middleware, navigatie en homepage.
 */
export function AppStatusSchakelaar() {
  const modus = useOpenModus()
  const [bezig, setBezig] = useState<OpenModus | null>(null)
  const openNu = effectiveOpen(modus)

  const kies = async (m: OpenModus) => {
    if (m === modus || bezig) return
    setBezig(m)
    try {
      await zetOpenModus(m)
      toast.success(
        m === "open"
          ? "De app is nu open voor gasten"
          : m === "dicht"
            ? "De app is gesloten voor gasten"
            : "De app volgt weer automatisch de trouwdag-tijd",
      )
    } catch {
      toast.error("Aanpassen mislukt — heb je hier rechten voor?")
    } finally {
      setBezig(null)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="font-serif text-lg font-bold">Toegang tot de app</h2>
          <p className="text-sm text-muted-foreground">
            Voor gasten nu{" "}
            <span className={cn("font-medium", openNu ? "text-green-600" : "text-foreground")}>
              {openNu ? "open" : "gesloten"}
            </span>
          </p>
        </div>
        <span
          className={cn("w-3 h-3 rounded-full shrink-0", openNu ? "bg-green-500" : "bg-muted-foreground/40")}
          aria-hidden
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {OPTIES.map((o) => {
          const Icon = o.icon
          const actief = o.modus === modus
          return (
            <button
              key={o.modus}
              type="button"
              onClick={() => kies(o.modus)}
              disabled={bezig !== null}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                actief ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
              )}
            >
              <span className="flex items-center gap-2 font-medium text-sm">
                {bezig === o.modus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {o.label}
                {actief && <span className="text-xs text-primary">• actief</span>}
              </span>
              <span className="text-xs text-muted-foreground">{o.uitleg}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
