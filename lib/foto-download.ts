// Download van geselecteerde foto's als één zip-bestand (één download-popup).
// Haalt elk bestand op via de Supabase-client, bundelt met JSZip en start
// daarna één download.
import JSZip from 'jszip'
import { createClient } from './supabase/client'

export interface DownloadFoto {
  id: string
  storage_path: string
  uploaded_by?: string | null
}

function bestandsnaam(p: DownloadFoto): string {
  const ext = p.storage_path.split('.').pop()?.split('?')[0] || 'jpg'
  const wie =
    (p.uploaded_by || 'foto')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'foto'
  return `${wie}-${p.id.slice(0, 8)}.${ext}`
}

/** Download één foto als bestand (i.p.v. openen in een nieuw tabblad). */
export async function downloadFoto(foto: DownloadFoto): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from('wedding-photos').download(foto.storage_path)
  if (error || !data) throw error ?? new Error('geen data')
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = bestandsnaam(foto)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Bundel de opgegeven foto's in één zip en download die.
 * onVoortgang wordt na elke opgehaalde foto aangeroepen (de zip-stap zelf is
 * verwaarloosbaar snel). Geeft het aantal foto's terug dat niet kon worden
 * opgehaald (die ontbreken dan in de zip).
 */
export async function downloadFotos(
  fotos: DownloadFoto[],
  onVoortgang?: (gedaan: number, totaal: number) => void,
): Promise<number> {
  const supabase = createClient()
  const zip = new JSZip()
  let mislukt = 0

  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i]
    try {
      const { data, error } = await supabase.storage.from('wedding-photos').download(f.storage_path)
      if (error || !data) throw error ?? new Error('geen data')
      zip.file(bestandsnaam(f), data)
    } catch (e) {
      console.error('Ophalen mislukt voor', f.storage_path, e)
      mislukt++
    }
    onVoortgang?.(i + 1, fotos.length)
  }

  if (mislukt >= fotos.length) return mislukt // niets op te leveren

  // Foto's zijn al gecomprimeerde JPEG's: STORE (geen deflate) is veel sneller.
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bruiloft-fotos.zip'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return mislukt
}
