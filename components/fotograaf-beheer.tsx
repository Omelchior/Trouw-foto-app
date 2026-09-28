"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  Maximize2,
  Moon,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PhotoLightbox } from "@/components/photo-lightbox"
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
import { createClient } from "@/lib/supabase/client"
import { uploadFotograafFoto } from "@/lib/foto-upload"
import { alleRijen, metUrls } from "@/lib/media"
import { cn } from "@/lib/utils"

interface FotograafFoto {
  id: string
  storage_path: string
  origineel_pad: string | null
  thumb_pad: string | null
  origineel_naam: string | null
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  zichtbaar_dag: boolean
  /** Ook avondgasten mogen hem zien (migratie 020). */
  zichtbaar_avond?: boolean
  media_type?: string | null
  url: string
  thumb_url: string
}

type Filter = "alle" | "zichtbaar" | "avond" | "verborgen"

/** Tegelijk lopende uploads: sneller dan één voor één, zonder de lijn te verstoppen. */
const GELIJKTIJDIG = 3
/** Zoveel tegels tegelijk tonen; de rest via "Toon meer". */
const PAGINA = 150
/** Bestandstypen die de browser kan verkleinen (geen RAW/HEIC). */
const ONDERSTEUND = /\.(jpe?g|png|webp)$/i

/** Supabase kapt lange .in()-lijsten af; in brokken bijwerken. */
function brokken<T>(items: T[], grootte = 200): T[][] {
  const uit: T[][] = []
  for (let i = 0; i < items.length; i += grootte) uit.push(items.slice(i, i + grootte))
  return uit
}

/**
 * Beheer van de fotograaf-foto's: uploaden (de uitgepakte zip, of een map in
 * één keer) en per foto kiezen of daggasten hem mogen zien en downloaden.
 * Avondgasten zien alleen de foto's die je met het maantje ook voor hen vrijgeeft
 * (afgedwongen in de database, migraties 019 en 020).
 */
export function FotograafBeheer() {
  const [fotos, setFotos] = useState<FotograafFoto[]>([])
  const [laden, setLaden] = useState(true)
  const [filter, setFilter] = useState<Filter>("alle")
  const [aantalTonen, setAantalTonen] = useState(PAGINA)
  const [lightbox, setLightbox] = useState<FotograafFoto | null>(null)
  const [bezig, setBezig] = useState<Set<string>>(new Set())
  const [bulkBezig, setBulkBezig] = useState(false)
  const [teVerwijderen, setTeVerwijderen] = useState<FotograafFoto | null>(null)

  // Uploadstatus
  const [voortgang, setVoortgang] = useState<{ klaar: number; totaal: number } | null>(null)
  const [mislukt, setMislukt] = useState<File[]>([])
  const bestandenRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<HTMLInputElement>(null)

  const ophalen = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await alleRijen((van, tot) =>
      supabase
        .from("photos")
        .select("*")
        .eq("bron", "fotograaf")
        .order("origineel_naam", { ascending: true })
        .order("id")
        .range(van, tot),
    )
    if (error) {
      console.error("Fotograaf-foto's ophalen mislukt", error)
      toast.error("Foto's ophalen mislukt — is migratie 019 al uitgevoerd?")
    } else {
      setFotos((data ?? []).map((p) => metUrls(supabase, p as Omit<FotograafFoto, "url" | "thumb_url">)))
    }
    setLaden(false)
  }, [])

  useEffect(() => {
    ophalen()
    // Tijdens een upload komen er honderden inserts binnen: gebundeld herladen.
    let timer: ReturnType<typeof setTimeout> | null = null
    const supabase = createClient()
    const kanaal = supabase
      .channel("fotograaf-beheer")
      .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(ophalen, 1500)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(kanaal)
    }
  }, [ophalen])

  // Niet per ongeluk wegklikken tijdens het uploaden.
  useEffect(() => {
    if (!voortgang) return
    const waarschuw = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", waarschuw)
    return () => window.removeEventListener("beforeunload", waarschuw)
  }, [voortgang])

  const uploaden = async (bestanden: File[]) => {
    const bekend = new Set(fotos.map((f) => f.origineel_naam).filter(Boolean))
    const fotoBestanden = bestanden.filter((f) => ONDERSTEUND.test(f.name))
    const overgeslagenType = bestanden.length - fotoBestanden.length
    const nieuw = fotoBestanden.filter((f) => !bekend.has(f.name))
    const dubbel = fotoBestanden.length - nieuw.length

    if (overgeslagenType > 0) toast.info(`${overgeslagenType} bestand(en) overgeslagen (geen jpg/png/webp)`)
    if (dubbel > 0) toast.info(`${dubbel} foto('s) stonden er al en zijn overgeslagen`)
    if (nieuw.length === 0) return

    setMislukt([])
    setVoortgang({ klaar: 0, totaal: nieuw.length })
    const fouten: File[] = []
    let klaar = 0
    let volgende = 0

    const werker = async () => {
      while (volgende < nieuw.length) {
        const file = nieuw[volgende++]
        try {
          await uploadFotograafFoto(file)
        } catch (e) {
          console.error("Upload mislukt", file.name, e)
          fouten.push(file)
        }
        klaar++
        setVoortgang({ klaar, totaal: nieuw.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(GELIJKTIJDIG, nieuw.length) }, werker))

    setVoortgang(null)
    setMislukt(fouten)
    if (fouten.length > 0) toast.warning(`${nieuw.length - fouten.length} geüpload, ${fouten.length} mislukt`)
    else toast.success(`${nieuw.length} foto's geüpload — kies hieronder welke daggasten zien`)
    ophalen()
  }

  const onBestanden = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lijst = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (lijst.length) uploaden(lijst)
  }

  type Vlaggen = Partial<Pick<FotograafFoto, "zichtbaar_dag" | "zichtbaar_avond">>

  const zetVlaggen = async (ids: string[], vlaggen: Vlaggen) => {
    if (ids.length === 0) return
    const supabase = createClient()
    // Direct tonen, bij een fout terugdraaien.
    const vorige = fotos
    setFotos((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, ...vlaggen } : f)))
    // Via een databasefunctie (migratie 021): die controleert de rol en geeft
    // een duidelijke fout, i.p.v. een update die stil 0 rijen raakt.
    for (const brok of brokken(ids)) {
      const { data, error } = await supabase.rpc("beheer_zet_foto_zichtbaar", {
        p_ids: brok,
        p_dag: vlaggen.zichtbaar_dag ?? null,
        p_avond: vlaggen.zichtbaar_avond ?? null,
      })
      if (error || data === 0) {
        console.error("Zichtbaarheid aanpassen mislukt", error ?? "0 foto's aangepast")
        toast.error(
          error?.code === "PGRST202"
            ? "Voer eerst migratie 021 uit in Supabase"
            : error
              ? `Aanpassen mislukt: ${error.message}`
              : "Er is niets aangepast, probeer het opnieuw",
        )
        setFotos(vorige)
        return
      }
    }
  }

  // Uit voor daggasten = voor niemand meer (dus ook niet voor de avond).
  const zetZichtbaar = (ids: string[], zichtbaar: boolean) =>
    zetVlaggen(ids, zichtbaar ? { zichtbaar_dag: true } : { zichtbaar_dag: false, zichtbaar_avond: false })

  const metBezig = async (foto: FotograafFoto, actie: () => Promise<void>) => {
    if (bezig.has(foto.id)) return
    setBezig((s) => new Set(s).add(foto.id))
    await actie()
    setBezig((s) => {
      const n = new Set(s)
      n.delete(foto.id)
      return n
    })
  }

  const toggle = (foto: FotograafFoto) =>
    metBezig(foto, () => zetZichtbaar([foto.id], !foto.zichtbaar_dag))

  // Ook voor avondgasten: dan zien daggasten hem uiteraard ook.
  const toggleAvond = (foto: FotograafFoto) =>
    metBezig(foto, () =>
      zetVlaggen([foto.id], foto.zichtbaar_avond ? { zichtbaar_avond: false } : { zichtbaar_avond: true, zichtbaar_dag: true }),
    )

  const gefilterd = useMemo(
    () =>
      fotos.filter((f) =>
        filter === "alle"
          ? true
          : filter === "zichtbaar"
            ? f.zichtbaar_dag || !!f.zichtbaar_avond
            : filter === "avond"
              ? !!f.zichtbaar_avond
              : !f.zichtbaar_dag && !f.zichtbaar_avond,
      ),
    [fotos, filter],
  )
  const zichtbaarAantal = fotos.filter((f) => f.zichtbaar_dag || f.zichtbaar_avond).length
  const avondAantal = fotos.filter((f) => f.zichtbaar_avond).length

  const bulk = async (zichtbaar: boolean) => {
    setBulkBezig(true)
    const ids = gefilterd.filter((f) => f.zichtbaar_dag !== zichtbaar).map((f) => f.id)
    await zetZichtbaar(ids, zichtbaar)
    setBulkBezig(false)
    if (ids.length) toast.success(`${ids.length} foto's ${zichtbaar ? "zichtbaar gemaakt" : "verborgen"}`)
  }

  const verwijderen = async () => {
    const foto = teVerwijderen
    if (!foto) return
    const supabase = createClient()
    const paden = [foto.storage_path, foto.origineel_pad, foto.thumb_pad].filter(
      (p): p is string => !!p,
    )
    await supabase.storage.from("wedding-photos").remove(paden)
    const { error } = await supabase.from("photos").delete().eq("id", foto.id)
    setTeVerwijderen(null)
    if (error) {
      toast.error("Verwijderen mislukt")
      return
    }
    setFotos((prev) => prev.filter((f) => f.id !== foto.id))
    toast.success("Foto verwijderd")
  }

  const zichtbareTegels = gefilterd.slice(0, aantalTonen)

  return (
    <div className="space-y-6">
      {/* Uploaden */}
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Camera className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold text-foreground leading-tight">
              Foto&apos;s van de fotograaf
            </h2>
            <p className="text-sm text-muted-foreground">
              Pak de zip eerst uit en kies dan de map (of selecteer alle foto&apos;s). Nieuwe
              foto&apos;s zijn nog voor niemand zichtbaar: jij kiest hieronder welke daggasten mogen
              zien en downloaden. Avondgasten zien alleen wat je met het maantje met hen deelt.
            </p>
          </div>
        </div>

        <input ref={bestandenRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onBestanden} />
        <input
          ref={mapRef}
          type="file"
          multiple
          hidden
          onChange={onBestanden}
          // Hele map in één keer kiezen (niet in de React-typen opgenomen).
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        />

        {voortgang ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Uploaden… {voortgang.klaar} van {voortgang.totaal}
              <span className="text-muted-foreground">— houd dit tabblad open</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(voortgang.klaar / voortgang.totaal) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => mapRef.current?.click()} className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Kies map
            </Button>
            <Button variant="outline" onClick={() => bestandenRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" />
              Kies foto&apos;s
            </Button>
            {mislukt.length > 0 && (
              <Button variant="outline" onClick={() => uploaden(mislukt)} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                {mislukt.length} mislukte opnieuw
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Selecteren voor daggasten */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{zichtbaarAantal}</span> van {fotos.length}{" "}
            zichtbaar voor daggasten, waarvan <span className="font-medium text-foreground">{avondAantal}</span>{" "}
            ook voor avondgasten. Tik op een foto om hem aan/uit te zetten; met het maantje deel je hem
            ook met de avond.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["alle", "zichtbaar", "avond", "verborgen"] as Filter[]).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => {
                  setFilter(f)
                  setAantalTonen(PAGINA)
                }}
              >
                {f === "alle" ? "Alle" : f === "zichtbaar" ? "Zichtbaar" : f === "avond" ? "Ook avond" : "Verborgen"}
              </Button>
            ))}
          </div>
        </div>

        {gefilterd.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={bulkBezig} onClick={() => bulk(true)} className="gap-2">
              <Eye className="w-4 h-4" />
              {filter === "alle" ? "Alles" : "Deze"} zichtbaar maken
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBezig} onClick={() => bulk(false)} className="gap-2">
              <EyeOff className="w-4 h-4" />
              {filter === "alle" ? "Alles" : "Deze"} verbergen
            </Button>
          </div>
        )}

        {laden ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : gefilterd.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {fotos.length === 0 ? "Nog geen foto's van de fotograaf geüpload." : "Geen foto's in deze selectie."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {zichtbareTegels.map((foto) => (
                <div
                  key={foto.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={foto.zichtbaar_dag}
                  aria-label={`${foto.origineel_naam ?? "Foto"}: ${foto.zichtbaar_dag ? "zichtbaar" : "verborgen"}`}
                  onClick={() => toggle(foto)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(foto))}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-muted select-none",
                    foto.zichtbaar_dag && (foto.zichtbaar_avond ? "ring-4 ring-amber-400" : "ring-4 ring-primary"),
                  )}
                >
                  <img
                    src={foto.thumb_url}
                    alt={foto.origineel_naam ?? "Foto van de fotograaf"}
                    loading="lazy"
                    className={cn(
                      "w-full h-full object-cover transition-opacity",
                      !foto.zichtbaar_dag && "opacity-45",
                    )}
                  />
                  <span
                    className={cn(
                      "absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center",
                      foto.zichtbaar_dag ? "bg-primary text-primary-foreground" : "bg-foreground/50 text-white",
                    )}
                  >
                    {bezig.has(foto.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : foto.zichtbaar_dag ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </span>
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button
                      type="button"
                      aria-label="Groot bekijken"
                      onClick={(e) => {
                        e.stopPropagation()
                        setLightbox(foto)
                      }}
                      className="w-7 h-7 rounded-full bg-foreground/50 text-white flex items-center justify-center hover:bg-foreground/70"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Verwijderen"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTeVerwijderen(foto)
                      }}
                      className="w-7 h-7 rounded-full bg-foreground/50 text-white flex items-center justify-center hover:bg-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="min-w-0 text-[10px] text-white truncate">{foto.origineel_naam}</p>
                    <button
                      type="button"
                      aria-pressed={!!foto.zichtbaar_avond}
                      aria-label={foto.zichtbaar_avond ? "Niet meer met avondgasten delen" : "Ook met avondgasten delen"}
                      title={foto.zichtbaar_avond ? "Gedeeld met avondgasten" : "Ook met avondgasten delen"}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleAvond(foto)
                      }}
                      className={cn(
                        "w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-colors",
                        foto.zichtbaar_avond
                          ? "bg-amber-400 text-amber-950"
                          : "bg-foreground/50 text-white hover:bg-foreground/70",
                      )}
                    >
                      <Moon className={cn("w-3.5 h-3.5", foto.zichtbaar_avond && "fill-current")} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {gefilterd.length > aantalTonen && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setAantalTonen((n) => n + PAGINA)}>
                  Toon meer ({gefilterd.length - aantalTonen} over)
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <PhotoLightbox
        photo={lightbox}
        photos={zichtbareTegels}
        onClose={() => setLightbox(null)}
        onNavigate={(p) => setLightbox(p as FotograafFoto)}
      />

      <AlertDialog open={teVerwijderen !== null} onOpenChange={(open) => !open && setTeVerwijderen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foto verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {teVerwijderen?.origineel_naam ?? "Deze foto"} wordt definitief verwijderd, inclusief het
              origineel. Je kunt hem daarna opnieuw uploaden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              onClick={verwijderen}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Verwijder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
