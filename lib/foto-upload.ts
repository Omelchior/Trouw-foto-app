// Gedeelde upload-logica: compressie, retries en het wegschrijven van één
// foto of video (storage + database-rij). Gebruikt door de upload-flow op de
// homepage/galerij en de opdrachten-carrousel.
import { createClient } from './supabase/client'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
/** Video's worden niet gecomprimeerd, dus mogen ze een stuk groter zijn.
 *  Zie scripts/018_videos.sql: de bucket moet dit ook toestaan. */
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024
const MAX_DIMENSION = 2400
const COMPRESSION_QUALITY = 0.85

/** Thumbnails voor de fotogrids: ~600px is scherp genoeg voor 3 per rij. */
export const THUMB_OPTIES: CompressieOpties = { maxDimensie: 600, kwaliteit: 0.8, altijd: true }

export type MediaType = 'foto' | 'video'

export function isVideo(file: File): boolean {
  return file.type.startsWith('video/')
}

/** Het maximum voor dit bestand: video's mogen groter zijn dan foto's. */
export function maxGrootte(file: File): number {
  return isVideo(file) ? MAX_VIDEO_SIZE : MAX_FILE_SIZE
}

/** Extensie voor het opgeslagen bestand (jpg na compressie, anders de eigen). */
function extensieVoor(origineel: File, opgeslagen: File): string {
  if (opgeslagen.type === 'image/jpeg' && !isVideo(origineel)) return 'jpg'
  const eigen = origineel.name.split('.').pop()?.toLowerCase()
  if (eigen && /^[a-z0-9]{1,5}$/.test(eigen)) return eigen
  // Sommige camera's leveren een bestand zonder nette naam; val terug op het
  // mime-type (video/quicktime -> mov, video/mp4 -> mp4).
  const uitMime = origineel.type.split('/')[1]
  if (uitMime === 'quicktime') return 'mov'
  return uitMime?.replace(/[^a-z0-9]/g, '') || (isVideo(origineel) ? 'mp4' : 'jpg')
}

export interface CompressieOpties {
  /** Langste zijde in pixels. */
  maxDimensie?: number
  kwaliteit?: number
  /** Ook kleine bestanden verkleinen (voor thumbnails). */
  altijd?: boolean
}

export async function compressImage(file: File, opties: CompressieOpties = {}): Promise<File> {
  const maxDimensie = opties.maxDimensie ?? MAX_DIMENSION
  const kwaliteit = opties.kwaliteit ?? COMPRESSION_QUALITY
  if (!file.type.startsWith('image/')) return file
  if (!opties.altijd && file.size < 500 * 1024) return file

  return new Promise((resolve) => {
    const img = new Image()
    const bron = URL.createObjectURL(file)
    // Het object-URL direct weer vrijgeven: bij honderden fotograaf-foto's
    // loopt het geheugen anders vol.
    const klaar = (resultaat: File) => {
      URL.revokeObjectURL(bron)
      resolve(resultaat)
    }
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let { width, height } = img
      if (width > maxDimensie || height > maxDimensie) {
        const ratio = Math.min(maxDimensie / width, maxDimensie / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { klaar(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            klaar(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
          } else {
            klaar(file)
          }
        },
        'image/jpeg',
        kwaliteit
      )
    }
    img.onerror = () => klaar(file)
    img.src = bron
  })
}

export async function uploadWithRetry<T>(op: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: Error | null = null
  for (let i = 1; i <= retries; i++) {
    try { return await op() } catch (e) {
      lastErr = e as Error
      if (i < retries) await new Promise(r => setTimeout(r, 1000 * i))
    }
  }
  throw lastErr
}

export interface UploadFotoOpties {
  file: File
  guestName: string
  userId: string
  challengeId?: number | null
  inFotoboek?: boolean
}

/**
 * Comprimeert (alleen foto's) en uploadt één bestand en registreert de
 * database-rij. Video's gaan ongewijzigd naar storage.
 */
export async function uploadFoto(opts: UploadFotoOpties): Promise<void> {
  const supabase = createClient()
  const video = isVideo(opts.file)
  const bestand = video ? opts.file : await compressImage(opts.file)
  const ext = extensieVoor(opts.file, bestand)
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  await uploadWithRetry(async () => {
    const { error } = await supabase.storage
      .from('wedding-photos')
      .upload(fileName, bestand, { contentType: bestand.type || undefined })
    if (error) throw error
  })

  // Kleine versie voor de fotogrids, zodat de galerij op een telefoon snel
  // blijft. Mislukt dat, dan toont het grid gewoon de gewone versie.
  let thumbPad: string | null = null
  if (!video) {
    try {
      const thumb = await compressImage(bestand, THUMB_OPTIES)
      if (thumb !== bestand) {
        thumbPad = `thumb/${fileName.replace(/\.[^.]+$/, '')}.jpg`
        await opslaan(thumbPad, thumb)
      }
    } catch (e) {
      console.warn('Thumbnail maken mislukt', e)
      thumbPad = null
    }
  }

  const rij = {
    storage_path: fileName,
    uploaded_by: opts.guestName,
    user_id: opts.userId,
    challenge_id: opts.challengeId ?? null,
    in_fotoboek: opts.inFotoboek ?? false,
    media_type: video ? 'video' : 'foto',
  }
  await uploadWithRetry(async () => {
    let { error } = await supabase.from('photos').insert(thumbPad ? { ...rij, thumb_pad: thumbPad } : rij)
    // Kolom thumb_pad bestaat pas na migratie 019: dan zonder thumbnail.
    if (error?.code === '42703' && thumbPad) {
      ;({ error } = await supabase.from('photos').insert(rij))
    }
    if (error) throw error
  })
}

/** Onderdeel van een fotograaf-upload dat in storage belandt. */
async function opslaan(pad: string, bestand: File): Promise<void> {
  const supabase = createClient()
  await uploadWithRetry(async () => {
    const { error } = await supabase.storage
      .from('wedding-photos')
      .upload(pad, bestand, { contentType: bestand.type || undefined })
    if (error) throw error
  })
}

/**
 * Upload één foto van de fotograaf (alleen beheer). Er komen drie versies in
 * storage onder 'fotograaf/': het origineel (voor downloads), een webversie
 * (weergave en diavoorstelling) en een thumbnail (fotogrids). De foto is na
 * upload nog voor niemand zichtbaar; dat kies je daarna in het beheer.
 */
export async function uploadFotograafFoto(file: File): Promise<void> {
  const supabase = createClient()
  const id = crypto.randomUUID()
  const eigenExt = file.name.split('.').pop()?.toLowerCase()
  const ext = eigenExt && /^[a-z0-9]{1,5}$/.test(eigenExt) ? eigenExt : 'jpg'

  const origineelPad = `fotograaf/origineel/${id}.${ext}`
  await opslaan(origineelPad, file)

  // Kleinere versies; is het origineel al klein genoeg, dan gebruiken we dat.
  const web = await compressImage(file)
  const webPad = web === file ? origineelPad : `fotograaf/${id}.jpg`
  if (web !== file) await opslaan(webPad, web)

  const thumb = await compressImage(file, THUMB_OPTIES)
  const thumbPad = thumb === file ? webPad : `fotograaf/thumb/${id}.jpg`
  if (thumb !== file) await opslaan(thumbPad, thumb)

  await uploadWithRetry(async () => {
    const { error } = await supabase.from('photos').insert({
      storage_path: webPad,
      origineel_pad: origineelPad === webPad ? null : origineelPad,
      thumb_pad: thumbPad === webPad ? null : thumbPad,
      origineel_naam: file.name,
      uploaded_by: 'Fotograaf',
      user_id: null,
      bron: 'fotograaf',
      zichtbaar_dag: false,
      media_type: 'foto',
    })
    if (error) throw error
  })
}

/**
 * Maak achteraf een thumbnail voor een bestaande foto (beheer). Geeft het pad
 * van de thumbnail terug, of null als het origineel al klein genoeg is.
 */
export async function maakThumbnail(foto: { id: string; storage_path: string }): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from('wedding-photos').download(foto.storage_path)
  if (error || !data) throw error ?? new Error('geen data')
  const bestand = new File([data], foto.storage_path.split('/').pop() ?? 'foto.jpg', {
    type: data.type || 'image/jpeg',
  })
  const thumb = await compressImage(bestand, THUMB_OPTIES)
  if (thumb === bestand) return null
  const pad = `thumb/${foto.storage_path.replace(/\.[^.]+$/, '')}.jpg`
  const { error: upErr } = await supabase.storage
    .from('wedding-photos')
    .upload(pad, thumb, { contentType: 'image/jpeg' })
  // Staat hij er al (van een eerdere poging), dan gebruiken we die gewoon.
  if (upErr && !/exists|duplicate/i.test(upErr.message)) throw upErr
  // Vastleggen via een databasefunctie (migratie 021), die de rol controleert.
  const { error: rpcErr } = await supabase.rpc('beheer_zet_thumb', { p_id: foto.id, p_pad: pad })
  if (rpcErr) throw rpcErr
  return pad
}
