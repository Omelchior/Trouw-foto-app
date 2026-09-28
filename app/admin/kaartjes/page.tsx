"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2, Printer, Scale, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useOpdrachten } from "@/components/opdrachten-provider"
import { createClient } from "@/lib/supabase/client"
import { herverdeelOpdrachtenEerlijk, type Aanwezigheid } from "@/lib/guest"
import { TROUWDATUM_TEKST } from "@/lib/bruiloft"
import { toast } from "sonner"

interface GastRij {
  id: string
  name: string
  tafel: number | null
  eerste_opdracht: number | null
  aanwezigheid: Aanwezigheid
  dagdeel: "dag" | "avond" | null
}

/** Eén te printen kaartje. */
interface Kaartje {
  id: string
  naam: string
  tafel: number | null
  opdrachtId: number
  tekst: string
}

type WieFilter = "alle" | "aangemeld" | "dag" | "avond"

const WIE_OPTIES: { value: WieFilter; tekst: string }[] = [
  { value: "alle", tekst: "Alle gasten" },
  { value: "aangemeld", tekst: "Alleen aangemeld" },
  { value: "dag", tekst: "Daggasten" },
  { value: "avond", tekst: "Alleen avondgasten" },
]

/** QR-code naar de app; op elk kaartje dezelfde (de gast kiest daarin z'n naam). */
function qrUrl(doel: string, formaat = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${formaat}x${formaat}&data=${encodeURIComponent(
    doel,
  )}&format=png&margin=0`
}

/**
 * Printbare foto-opdracht kaartjes: per gast één kaartje met zijn naam, de aan
 * hem toegewezen opdracht en een QR-code naar de app. 4 of 8 kaartjes op een
 * A4tje, met stippellijnen om langs te knippen.
 *
 * De toewijzing komt uit guests.eerste_opdracht — verdeel eerst eerlijk (knop
 * hierboven of op het tabblad Opdrachten) en print daarna.
 */
export default function KaartjesPage() {
  const router = useRouter()
  const opdrachten = useOpdrachten()

  const [gasten, setGasten] = useState<GastRij[] | "loading">("loading")
  const [wie, setWie] = useState<WieFilter>("alle")
  const [tafel, setTafel] = useState("")
  const [perPagina, setPerPagina] = useState<4 | 8>(4)
  const [metQr, setMetQr] = useState(true)
  const [siteUrl, setSiteUrl] = useState("")
  const [verdeelBezig, setVerdeelBezig] = useState(false)
  const [verdeelOpen, setVerdeelOpen] = useState(false)

  const laden = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("guests")
      .select("id, name, tafel, eerste_opdracht, aanwezigheid, dagdeel")
      .order("name")
    if (error) {
      console.error(error)
      toast.error("Kon de gastenlijst niet laden")
      setGasten([])
      return
    }
    setGasten((data as GastRij[]) ?? [])
  }

  useEffect(() => {
    laden()
    setSiteUrl(window.location.origin)
  }, [])

  const lijst = gasten === "loading" ? [] : gasten

  const tafels = useMemo(
    () =>
      Array.from(new Set(lijst.map((g) => g.tafel).filter((t): t is number => t != null))).sort(
        (a, b) => a - b,
      ),
    [lijst],
  )

  const tekstVan = (id: number) =>
    opdrachten.find((o) => o.id === id)?.text ?? `Opdracht ${id}`

  const gefilterd = useMemo(() => {
    return lijst.filter((g) => {
      if (wie === "aangemeld" && g.aanwezigheid !== "aangemeld") return false
      if (wie === "dag" && g.dagdeel !== "dag") return false
      if (wie === "avond" && g.dagdeel !== "avond") return false
      if (tafel && String(g.tafel ?? "") !== tafel) return false
      return true
    })
  }, [lijst, wie, tafel])

  // Op tafel gesorteerd (gasten zonder tafel achteraan), dan op naam: zo kun je
  // de geprinte stapel per tafel uitdelen.
  const kaartjes = useMemo<Kaartje[]>(() => {
    return gefilterd
      .filter((g) => g.eerste_opdracht != null)
      .slice()
      .sort((a, b) => {
        const ta = a.tafel ?? Number.MAX_SAFE_INTEGER
        const tb = b.tafel ?? Number.MAX_SAFE_INTEGER
        if (ta !== tb) return ta - tb
        return a.name.localeCompare(b.name)
      })
      .map((g) => ({
        id: g.id,
        naam: g.name,
        tafel: g.tafel,
        opdrachtId: g.eerste_opdracht as number,
        tekst: tekstVan(g.eerste_opdracht as number),
      }))
  }, [gefilterd, opdrachten])

  const zonderOpdracht = gefilterd.filter((g) => g.eerste_opdracht == null)

  /**
   * Hoe eerlijk staat de huidige verdeling erbij? Puur lezen, over de hele
   * gastenlijst — zo kun je een handmatige verdeling controleren zonder hem
   * te overschrijven.
   */
  const balans = useMemo(() => {
    const metOpdracht = lijst.filter((g) => g.eerste_opdracht != null)
    const telling = new Map<number, number>()
    for (const g of metOpdracht) {
      const id = g.eerste_opdracht as number
      telling.set(id, (telling.get(id) ?? 0) + 1)
    }
    const aantallen = opdrachten.map((o) => telling.get(o.id) ?? 0)

    // Dezelfde opdracht meer dan één keer aan dezelfde tafel.
    const perTafel = new Map<string, number>()
    for (const g of metOpdracht) {
      if (g.tafel == null) continue
      const sleutel = `${g.tafel}|${g.eerste_opdracht}`
      perTafel.set(sleutel, (perTafel.get(sleutel) ?? 0) + 1)
    }
    const dubbel = [...perTafel.entries()]
      .filter(([, aantal]) => aantal > 1)
      .map(([sleutel, aantal]) => {
        const [t, o] = sleutel.split("|")
        return { tafel: Number(t), opdrachtId: Number(o), aantal }
      })
      .sort((a, b) => a.tafel - b.tafel || a.opdrachtId - b.opdrachtId)

    return {
      gasten: metOpdracht.length,
      min: aantallen.length ? Math.min(...aantallen) : 0,
      max: aantallen.length ? Math.max(...aantallen) : 0,
      ongebruikt: aantallen.filter((a) => a === 0).length,
      eerlijkMax: opdrachten.length ? Math.ceil(metOpdracht.length / opdrachten.length) : 0,
      dubbel,
    }
  }, [lijst, opdrachten])

  const bladen = useMemo(() => {
    const out: Kaartje[][] = []
    for (let i = 0; i < kaartjes.length; i += perPagina) {
      out.push(kaartjes.slice(i, i + perPagina))
    }
    return out
  }, [kaartjes, perPagina])

  const verdeelEerlijk = async () => {
    setVerdeelBezig(true)
    try {
      const r = await herverdeelOpdrachtenEerlijk()
      toast.success(
        `${r.gasten} gasten verdeeld · elke opdracht ${r.minPerOpdracht}-${r.maxPerOpdracht}×` +
          (r.dubbelAanTafel > 0 ? ` · ${r.dubbelAanTafel}× dubbel aan een tafel` : ""),
      )
      setVerdeelOpen(false)
      await laden()
    } catch (e) {
      console.error("Verdelen mislukt", e)
      toast.error("Verdelen mislukt, probeer het opnieuw")
    } finally {
      setVerdeelBezig(false)
    }
  }

  const klein = perPagina === 8

  return (
    <main className="min-h-screen pb-16 bg-background print:bg-white print:pb-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@page { size: A4 portrait; margin: 0; }

.kaartjes-blad {
  width: 210mm;
  height: 297mm;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  background: #ffffff;
  color: #1b2b2b;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.kaartjes-blad[data-per-pagina="8"] { grid-template-rows: repeat(4, 1fr); }

.kaartje {
  border: 0.3mm dashed #b9cfcf;
  padding: 10mm 9mm;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.kaartjes-blad[data-per-pagina="8"] .kaartje { padding: 6mm 8mm; }

.kaartje-kop {
  font-size: 8pt;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6b8b8b;
}
.kaartje-naam { font-size: 20pt; line-height: 1.1; color: #1b2b2b; }
.kaartjes-blad[data-per-pagina="8"] .kaartje-naam { font-size: 15pt; }
.kaartje-tafel { font-size: 8.5pt; color: #6b8b8b; }

.kaartje-scheiding { border-top: 0.3mm solid #d8e5e5; }

.kaartje-label {
  font-size: 8pt;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3d8b8b;
}
.kaartje-nummer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 9mm;
  height: 9mm;
  border-radius: 999px;
  background: #3d8b8b;
  color: #ffffff;
  font-size: 9.5pt;
  font-weight: 700;
}
.kaartjes-blad[data-per-pagina="8"] .kaartje-nummer { width: 7mm; height: 7mm; font-size: 8pt; }

.kaartje-opdracht { font-size: 13pt; line-height: 1.35; color: #1b2b2b; }
.kaartjes-blad[data-per-pagina="8"] .kaartje-opdracht { font-size: 10.5pt; }

.kaartje-voet { font-size: 8pt; line-height: 1.35; color: #6b8b8b; }
.kaartje-qr { width: 18mm; height: 18mm; }
.kaartjes-blad[data-per-pagina="8"] .kaartje-qr { width: 14mm; height: 14mm; }

@media screen {
  .kaartjes-blad {
    margin: 0 auto 1.5rem;
    box-shadow: 0 2px 12px rgb(0 0 0 / 0.12);
    max-width: 100%;
  }
}

@media print {
  .kaartjes-blad { margin: 0; box-shadow: none; break-after: page; }
  .kaartjes-blad:last-child { break-after: auto; }
}
`,
        }}
      />

      <div className="max-w-5xl mx-auto px-4 py-6 print:hidden">
        <header className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Printer className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">Foto-opdracht kaartjes</h1>
              <p className="text-sm text-muted-foreground">
                {kaartjes.length} kaartjes op {bladen.length} A4&apos;tje{bladen.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => window.print()} disabled={kaartjes.length === 0} className="gap-2">
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin")}
              className="gap-2 bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" /> Terug naar beheer
            </Button>
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card p-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Wie</Label>
            <select
              value={wie}
              onChange={(e) => setWie(e.target.value as WieFilter)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {WIE_OPTIES.map((o) => (
                <option key={o.value} value={o.value}>{o.tekst}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tafel</Label>
            <select
              value={tafel}
              onChange={(e) => setTafel(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Alle tafels</option>
              {tafels.map((t) => (
                <option key={t} value={String(t)}>Tafel {t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kaartjes per A4</Label>
            <select
              value={perPagina}
              onChange={(e) => setPerPagina(parseInt(e.target.value, 10) as 4 | 8)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value={4}>4 (A6, groot)</option>
              <option value={8}>8 (klein)</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">QR-code naar de app</Label>
            <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm">
              <input
                type="checkbox"
                checked={metQr}
                onChange={(e) => setMetQr(e.target.checked)}
                className="h-4 w-4"
              />
              QR op het kaartje
            </label>
          </div>
        </div>

        {/* Controle op de huidige verdeling — handmatig of automatisch gemaakt. */}
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium mb-1">Huidige verdeling</p>
              <p className="text-muted-foreground">
                {balans.gasten} gasten met een opdracht · elke opdracht {balans.min}–{balans.max}×
                {balans.max > balans.eerlijkMax && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {" "}
                    (gelijkmatig zou max. {balans.eerlijkMax}× zijn)
                  </span>
                )}
                {balans.ongebruikt > 0 && ` · ${balans.ongebruikt} opdrachten nog door niemand`}
              </p>
              {balans.dubbel.length > 0 ? (
                <p className="text-amber-700 dark:text-amber-400 mt-1">
                  Dubbel aan één tafel:{" "}
                  {balans.dubbel
                    .map((d) => `tafel ${d.tafel} → #${d.opdrachtId} (${d.aantal}×)`)
                    .join(", ")}
                </p>
              ) : (
                <p className="text-muted-foreground mt-1">
                  Aan geen enkele tafel heeft iemand dezelfde opdracht. 👌
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVerdeelOpen(true)}
              className="gap-2 bg-transparent shrink-0"
            >
              <Scale className="w-4 h-4" />
              Opnieuw eerlijk verdelen
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Let op: opnieuw verdelen overschrijft de huidige toewijzing — ook handmatige
            aanpassingen. Wil je alleen printen, laat deze knop dan staan.
          </p>
        </div>

        {zonderOpdracht.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p>
              <strong>{zonderOpdracht.length}</strong> gast
              {zonderOpdracht.length === 1 ? "" : "en"} zonder opdracht — die krijgen geen kaartje:{" "}
              {zonderOpdracht.map((g) => g.name).join(", ")}. Verdeel eerst eerlijk.
            </p>
          </div>
        )}

        {gasten === "loading" ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : kaartjes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Geen kaartjes om te printen. Pas de filters aan of verdeel eerst de opdrachten.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Voorbeeld hieronder is exact wat er uit de printer komt (A4, geen marges — zet in het
            printvenster &quot;Marges: geen&quot; en schaal op 100%).
          </p>
        )}
      </div>

      {/* De printbare bladen: op het scherm als voorbeeld, in print zonder de rest. */}
      <div className="px-4 print:px-0">
        {bladen.map((blad, i) => (
          <div key={i} className="kaartjes-blad" data-per-pagina={perPagina}>
            {blad.map((k) => (
              <div key={k.id} className="kaartje">
                <div className="kaartje-kop font-sans">Olaf &amp; Ester · {TROUWDATUM_TEKST}</div>

                <div className={klein ? "mt-2" : "mt-4"}>
                  <p className="kaartje-naam font-serif">{k.naam}</p>
                  {k.tafel != null && <p className="kaartje-tafel font-sans">Tafel {k.tafel}</p>}
                </div>

                <div className={klein ? "kaartje-scheiding mt-3 pt-3" : "kaartje-scheiding mt-5 pt-5"}>
                  <div className="flex items-center gap-2">
                    <span className="kaartje-nummer font-sans">{k.opdrachtId}</span>
                    <span className="kaartje-label font-sans">Jouw foto-opdracht</span>
                  </div>
                  <p className={klein ? "kaartje-opdracht font-serif mt-2" : "kaartje-opdracht font-serif mt-3"}>
                    {k.tekst}
                  </p>
                </div>

                <div className="mt-auto flex items-end gap-3 pt-3">
                  {metQr && siteUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrUrl(siteUrl)}
                      alt=""
                      className="kaartje-qr shrink-0"
                    />
                  )}
                  <p className="kaartje-voet font-sans">
                    {metQr
                      ? "Scan de code, kies je naam en upload je foto."
                      : `Ga naar ${siteUrl.replace(/^https?:\/\//, "")}, kies je naam en upload je foto.`}
                    <br />
                    Daarna wacht de volgende opdracht op je!
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <AlertDialog open={verdeelOpen} onOpenChange={setVerdeelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Huidige toewijzing overschrijven?</AlertDialogTitle>
            <AlertDialogDescription>
              Iedereen krijgt een nieuwe opdracht: elke opdracht ongeveer even vaak, aan dezelfde
              tafel nooit twee keer dezelfde, en niemand krijgt iets wat hij al gedaan heeft.
              Handmatige aanpassingen aan de verdeling gaan hiermee verloren. Reeds gemaakte
              foto&apos;s blijven staan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={verdeelBezig}>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                verdeelEerlijk()
              }}
              disabled={verdeelBezig}
              className="gap-2"
            >
              {verdeelBezig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
              Verdeel eerlijk
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
