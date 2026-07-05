"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Search, Crown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getGuestList, zetAanmeldingVoor, type GuestListEntry } from "@/lib/guest"
import { toast } from "sonner"

/**
 * Compacte aanmeldingenlijst voor beheer en ceremoniemeesters:
 * zoeken + per gast de aanmelding aan/uit zetten. Geen namen/rollen bewerken.
 */
export function AanmeldingenManager() {
  const [guests, setGuests] = useState<GuestListEntry[] | "loading">("loading")
  const [query, setQuery] = useState("")

  useEffect(() => {
    getGuestList().then((list) => setGuests(list))
  }, [])

  const list = guests === "loading" ? [] : guests

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((g) => g.name.toLowerCase().includes(q))
  }, [list, query])

  const toggle = async (g: GuestListEntry) => {
    try {
      await zetAanmeldingVoor(g.slug, !g.aangemeld)
      setGuests((prev) =>
        prev === "loading"
          ? prev
          : prev.map((row) => (row.slug === g.slug ? { ...row, aangemeld: !g.aangemeld } : row)),
      )
    } catch (err) {
      console.error(err)
      toast.error("Aanmelding wijzigen mislukt")
    }
  }

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek een gast..."
          className="pl-10 h-10"
        />
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {list.filter((g) => g.aangemeld).length} van {list.length} gasten aangemeld
      </p>

      {guests === "loading" ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Geen gasten gevonden</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => (
            <div
              key={g.slug}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span className="flex items-center gap-2 font-medium min-w-0 truncate">
                {g.name}
                {g.label && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary shrink-0">
                    <Crown className="w-3 h-3" />
                    {g.label}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => toggle(g)}
                title={g.aangemeld ? "Aangemeld (klik om af te melden)" : "Niet aangemeld (klik om aan te melden)"}
                className={
                  g.aangemeld
                    ? "text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground font-medium shrink-0"
                    : "text-xs px-2 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted shrink-0"
                }
              >
                {g.aangemeld ? "Aangemeld" : "Aanmelden"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
