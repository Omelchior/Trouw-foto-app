// Download van geselecteerde foto's als zip-bestand. Haalt elk bestand op via
// de Supabase-client, bundelt met JSZip en start daarna de download. Grote
// selecties (originelen van de fotograaf!) worden over meerdere zips verdeeld,
// zodat een telefoon niet alles tegelijk in het geheugen hoeft te houden.
import JSZip from 'jszip'
import { createClient } from './supabase/client'

export interface DownloadFoto {
  id: string
  storage_path: string
  uploaded_by?: string | null
  /** Volle-resolutie versie (fotograaf); anders is storage_path het origineel. */
  origineel_pad?: string | null
  origineel_naam?: string | null
}

/** Het pad dat gedownload wordt: het origineel als dat er is. */
function downloadPad(p: DownloadFoto): string {
  return p.origineel_pad || p.storage_path
}

/** Maximale grootte van één zip voordat er een volgende begint. */
const MAX_ZIP_BYTES = 400 * 1024 * 1024

function startDownload(blob: Blob, naam: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = naam
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Even wachten: sommige browsers starten de download pas na deze tick.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function bestandsnaam(p: DownloadFoto): string {
  if (p.origineel_naam) return p.origineel_naam
  const ext = downloadPad(p).split('.').pop()?.split('?')[0] || 'jpg'
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
  const { data, error } = await supabase.storage.from('wedding-photos').download(downloadPad(foto))
  if (error || !data) throw error ?? new Error('geen data')
  startDownload(data, bestandsnaam(foto))
}

/**
 * Bundel de opgegeven foto's in zip-bestanden en download die. Past het niet in
 * één zip van ~400 MB, dan volgen er meer (bruiloft-fotos-1.zip, -2.zip, ...).
 * onVoortgang wordt na elke opgehaalde foto aangeroepen. Geeft het aantal
 * foto's terug dat niet kon worden opgehaald (die ontbreken dan in de zip).
 */
export async function downloadFotos(
  fotos: DownloadFoto[],
  onVoortgang?: (gedaan: number, totaal: number) => void,
): Promise<number> {
  const supabase = createClient()
  let zip = new JSZip()
  let zipBytes = 0
  let zipAantal = 0
  let deel = 0
  let namen = new Set<string>()
  let mislukt = 0

  // Een volle zip meteen downloaden en vergeten, zodat het geheugen vrijkomt.
  // Alleen als het bij één zip blijft heet hij gewoon bruiloft-fotos.zip.
  const afronden = async (laatste: boolean) => {
    if (zipAantal === 0) return
    // Foto's zijn al gecomprimeerde JPEG's: STORE (geen deflate) is veel sneller.
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
    deel++
    startDownload(blob, laatste && deel === 1 ? 'bruiloft-fotos.zip' : `bruiloft-fotos-${deel}.zip`)
    zip = new JSZip()
    zipBytes = 0
    zipAantal = 0
    namen = new Set()
  }

  // Twee foto's met dezelfde naam mogen elkaar in de zip niet overschrijven.
  const uniekeNaam = (naam: string) => {
    if (!namen.has(naam)) return naam
    const punt = naam.lastIndexOf('.')
    const basis = punt > 0 ? naam.slice(0, punt) : naam
    const ext = punt > 0 ? naam.slice(punt) : ''
    let n = 2
    while (namen.has(`${basis}-${n}${ext}`)) n++
    return `${basis}-${n}${ext}`
  }

  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i]
    try {
      const { data, error } = await supabase.storage.from('wedding-photos').download(downloadPad(f))
      if (error || !data) throw error ?? new Error('geen data')
      if (zipAantal > 0 && zipBytes + data.size > MAX_ZIP_BYTES) await afronden(false)
      const naam = uniekeNaam(bestandsnaam(f))
      namen.add(naam)
      zip.file(naam, data)
      zipBytes += data.size
      zipAantal++
    } catch (e) {
      console.error('Ophalen mislukt voor', downloadPad(f), e)
      mislukt++
    }
    onVoortgang?.(i + 1, fotos.length)
  }
  await afronden(true)

  return mislukt
}
