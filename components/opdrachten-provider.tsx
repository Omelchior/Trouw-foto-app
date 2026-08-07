"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { CHALLENGES, getOpdrachtTeksten, mergeOpdrachten, type Challenge } from "@/lib/guest"

/**
 * App-brede context met de (mogelijk via beheer aangepaste) opdracht-teksten.
 * Leest één keer uit de database en werkt live bij op wijzigingen, zodat een
 * tekstaanpassing meteen overal doorkomt. Valt terug op de hardcoded lijst.
 */
const OpdrachtenContext = createContext<Challenge[]>(CHALLENGES)

export function OpdrachtenProvider({ children }: { children: ReactNode }) {
  const [opdrachten, setOpdrachten] = useState<Challenge[]>(CHALLENGES)

  useEffect(() => {
    let actief = true
    const laden = async () => {
      const teksten = await getOpdrachtTeksten()
      if (actief) setOpdrachten(mergeOpdrachten(teksten))
    }
    laden()

    const supabase = createClient()
    const kanaal = supabase
      .channel("opdracht-teksten-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opdracht_teksten" },
        () => laden()
      )
      .subscribe()

    return () => {
      actief = false
      supabase.removeChannel(kanaal)
    }
  }, [])

  return <OpdrachtenContext.Provider value={opdrachten}>{children}</OpdrachtenContext.Provider>
}

/** De opdrachtenlijst met actuele teksten. */
export function useOpdrachten(): Challenge[] {
  return useContext(OpdrachtenContext)
}

/** De actuele tekst van één opdracht (valt terug op de standaardtekst). */
export function useOpdrachtTekst(id: number): string {
  const lijst = useOpdrachten()
  return lijst.find((c) => c.id === id)?.text ?? `Opdracht ${id}`
}
