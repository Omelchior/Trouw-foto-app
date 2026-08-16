// Client-helpers rond de handmatige app-open-schakelaar (tabel app_status,
// migratie 016). De pure open/dicht-logica (effectiveOpen, OpenModus) staat in
// lib/bruiloft.ts zodat de edge-middleware die ook kan gebruiken.
import { useEffect, useState } from 'react'
import { createClient } from './supabase/client'
import type { OpenModus } from './bruiloft'

export type { OpenModus }

/** Lees de huidige open-modus. Standaard 'auto' bij een fout of ontbrekende rij. */
export async function getOpenModus(): Promise<OpenModus> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('app_status')
    .select('open_modus')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return 'auto'
  return (data as { open_modus?: OpenModus }).open_modus ?? 'auto'
}

/**
 * Beheer/ceremoniemeester zet de app open, dicht of terug op automatisch.
 * Gooit een fout als de gebruiker geen rechten heeft (RLS blokkeert de update,
 * dan komt er 0 rijen terug in plaats van een harde fout).
 */
export async function zetOpenModus(modus: OpenModus): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('app_status')
    .update({ open_modus: modus, bijgewerkt_op: new Date().toISOString() })
    .eq('id', 1)
    .select('open_modus')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Geen rechten om de app-status aan te passen')
}

/** React-hook: de huidige open-modus, live bijgewerkt via realtime. */
export function useOpenModus(): OpenModus {
  const [modus, setModus] = useState<OpenModus>('auto')

  useEffect(() => {
    const supabase = createClient()
    let active = true

    getOpenModus().then((m) => {
      if (active) setModus(m)
    })

    const channel = supabase
      .channel(`app-status-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_status' },
        (payload) => {
          const m = (payload.new as { open_modus?: OpenModus })?.open_modus
          if (m) setModus(m)
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  return modus
}
