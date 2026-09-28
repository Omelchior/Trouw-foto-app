"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PersonenFilterProps {
  /** [naam, aantal foto's] per gast. */
  personen: [string, number][]
  totaal: number
  gekozen: Set<string>
  onChange: (gekozen: Set<string>) => void
}

/**
 * "Van wie"-keuzelijst waarin je meerdere gasten tegelijk aanvinkt. Met een
 * zoekveld, want met tientallen namen is scrollen alleen niet te doen.
 */
export function PersonenFilter({ personen, totaal, gekozen, onChange }: PersonenFilterProps) {
  const [open, setOpen] = useState(false)
  const [zoek, setZoek] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  // Sluiten bij tikken buiten de lijst of Escape.
  useEffect(() => {
    if (!open) return
    const buiten = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const toets = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", buiten)
    document.addEventListener("keydown", toets)
    return () => {
      document.removeEventListener("pointerdown", buiten)
      document.removeEventListener("keydown", toets)
    }
  }, [open])

  const alfabetisch = [...personen].sort((a, b) => a[0].localeCompare(b[0]))
  const q = zoek.trim().toLowerCase()
  const zichtbaar = q ? alfabetisch.filter(([naam]) => naam.toLowerCase().includes(q)) : alfabetisch

  const wissel = (naam: string) => {
    const n = new Set(gekozen)
    if (n.has(naam)) n.delete(naam)
    else n.add(naam)
    onChange(n)
  }

  const namen = [...gekozen]
  const label =
    namen.length === 0
      ? `Van iedereen (${totaal})`
      : namen.length <= 2
        ? namen.join(", ")
        : `${namen.length} gasten gekozen`

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full h-9 flex items-center gap-2 rounded-md border bg-card pl-3 pr-2 text-sm text-left",
          namen.length ? "border-primary text-foreground font-medium" : "border-border text-muted-foreground",
        )}
      >
        <span className="flex-1 min-w-0 truncate">{label}</span>
        {namen.length > 0 ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Filter wissen"
            onClick={(e) => {
              e.stopPropagation()
              onChange(new Set())
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation()
                onChange(new Set())
              }
            }}
            className="w-6 h-6 -mr-0.5 flex items-center justify-center rounded hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </span>
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover shadow-lg">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoek een naam…"
                className="w-full h-9 rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-72 overflow-y-auto py-1">
            {zichtbaar.map(([naam, aantal]) => {
              const aan = gekozen.has(naam)
              return (
                <li key={naam}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={aan}
                    onClick={() => wissel(naam)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "w-5 h-5 shrink-0 rounded border flex items-center justify-center",
                        aan ? "bg-primary border-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {aan && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0 truncate">{naam}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{aantal}</span>
                  </button>
                </li>
              )
            })}
            {zichtbaar.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">Geen gast gevonden</li>
            )}
          </ul>
          <div className="flex items-center justify-between gap-2 p-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => onChange(new Set())} disabled={namen.length === 0}>
              Wis
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Klaar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
