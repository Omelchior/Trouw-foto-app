// Herkennen of een geüpload item een foto of een video is. De kolom
// media_type (zie scripts/018_videos.sql) is leidend; valt die weg, dan
// bepaalt de bestandsextensie het.
import type { createClient } from './supabase/client'

const VIDEO_EXTENSIES = /\.(mp4|mov|m4v|webm|avi|3gp|mkv)$/i

export function isVideoPad(pad?: string | null): boolean {
  return !!pad && VIDEO_EXTENSIES.test(pad.split('?')[0])
}

export interface MediaItem {
  media_type?: string | null
  storage_path?: string | null
}

export function isVideoItem(item: MediaItem): boolean {
  if (item.media_type) return item.media_type === 'video'
  return isVideoPad(item.storage_path)
}

/** Foto van de fotograaf (zie scripts/019_fotograaf_fotos.sql). */
export function isFotograafItem(item: { bron?: string | null }): boolean {
  return item.bron === 'fotograaf'
}

/**
 * Fotograaf-foto die in het beheer is vrijgegeven (voor daggasten, of ook voor
 * de avond). Wie hem daadwerkelijk krijgt, regelt de database (migratie 019/020);
 * dit filter zorgt dat ook beheer in de galerij alleen de vrijgegeven ziet.
 */
export function isVrijgegevenFotograaf(item: {
  bron?: string | null
  zichtbaar_dag?: boolean | null
  zichtbaar_avond?: boolean | null
}): boolean {
  return isFotograafItem(item) && (!!item.zichtbaar_dag || !!item.zichtbaar_avond)
}

/** Supabase geeft per verzoek maximaal zoveel rijen terug. */
const PAGINA = 1000

/**
 * Haal ALLE rijen op, in pagina's van 1000. Zonder dit kapt Supabase stil af
 * bij 1000 rijen, en met honderden fotograaf-foto's vielen dan de oudste
 * gastfoto's weg. De query moet een vaste volgorde hebben (order + id).
 */
export async function alleRijen<T, E>(
  pagina: (van: number, tot: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
): Promise<{ data: T[]; error: E | null }> {
  const alles: T[] = []
  for (let van = 0; ; van += PAGINA) {
    const { data, error } = await pagina(van, van + PAGINA - 1)
    if (error) return { data: alles, error }
    alles.push(...(data ?? []))
    if (!data || data.length < PAGINA) return { data: alles, error: null }
  }
}

export interface OpslagItem {
  storage_path: string
  thumb_pad?: string | null
}

/**
 * Voeg de publieke URL's toe: `url` (weergave) en `thumb_url` (fotogrids; valt
 * terug op de weergave-versie als er geen aparte thumbnail is).
 */
export function metUrls<T extends OpslagItem>(
  supabase: ReturnType<typeof createClient>,
  item: T,
): T & { url: string; thumb_url: string } {
  const bucket = supabase.storage.from('wedding-photos')
  const url = bucket.getPublicUrl(item.storage_path).data.publicUrl
  const thumb_url = item.thumb_pad ? bucket.getPublicUrl(item.thumb_pad).data.publicUrl : url
  return { ...item, url, thumb_url }
}
