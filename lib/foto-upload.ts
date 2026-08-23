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

export async function compressImage(file: File): Promise<File> {
  if (file.size < 500 * 1024 || !file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        COMPRESSION_QUALITY
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
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

  await uploadWithRetry(async () => {
    const { error } = await supabase.from('photos').insert({
      storage_path: fileName,
      uploaded_by: opts.guestName,
      user_id: opts.userId,
      challenge_id: opts.challengeId ?? null,
      in_fotoboek: opts.inFotoboek ?? false,
      media_type: video ? 'video' : 'foto',
    })
    if (error) throw error
  })
}
