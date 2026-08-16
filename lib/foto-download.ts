// Download van foto's als losse bestanden (geen zip). Haalt elk bestand op via
// de Supabase-client en start een download met de download-attribuut-truc.
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

/**
 * Download de opgegeven foto's stuk voor stuk als los bestand.
 * onVoortgang wordt na elk bestand aangeroepen. Geeft het aantal mislukte
 * downloads terug.
 */
export async function downloadFotos(
  fotos: DownloadFoto[],
  onVoortgang?: (gedaan: number, totaal: number) => void,
): Promise<number> {
  const supabase = createClient()
  let mislukt = 0
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i]
    try {
      const { data, error } = await supabase.storage.from('wedding-photos').download(f.storage_path)
      if (error || !data) throw error ?? new Error('geen data')
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = bestandsnaam(f)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download mislukt voor', f.storage_path, e)
      mislukt++
    }
    onVoortgang?.(i + 1, fotos.length)
    // Kleine pauze zodat de browser meerdere downloads niet blokkeert.
    await new Promise((r) => setTimeout(r, 350))
  }
  return mislukt
}
