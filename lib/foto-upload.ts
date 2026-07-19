// Gedeelde upload-logica: compressie, retries en het wegschrijven van één
// foto (storage + database-rij). Gebruikt door de upload-flow op de
// homepage/galerij en de opdrachten-carrousel.
import { createClient } from './supabase/client'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 2400
const COMPRESSION_QUALITY = 0.85

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

/** Comprimeert en uploadt één foto en registreert de database-rij. */
export async function uploadFoto(opts: UploadFotoOpties): Promise<void> {
  const supabase = createClient()
  const compressed = await compressImage(opts.file)
  const ext = compressed.type === 'image/jpeg' ? 'jpg' : opts.file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  await uploadWithRetry(async () => {
    const { error } = await supabase.storage.from('wedding-photos').upload(fileName, compressed)
    if (error) throw error
  })

  await uploadWithRetry(async () => {
    const { error } = await supabase.from('photos').insert({
      storage_path: fileName,
      uploaded_by: opts.guestName,
      user_id: opts.userId,
      challenge_id: opts.challengeId ?? null,
      in_fotoboek: opts.inFotoboek ?? false,
    })
    if (error) throw error
  })
}
