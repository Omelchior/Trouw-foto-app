"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { Loader2, Camera, ChevronUp, Heart, Target, CheckSquare, Square, Download, X, MonitorPlay, Plus, ArrowUpDown } from "lucide-react"
import { PhotoGrid } from "@/components/photo-grid"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { PersonenFilter } from "@/components/personen-filter"
import { PhotoUpload } from "@/components/photo-upload"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getGuestSession, type GuestSession } from "@/lib/guest"
import { useOpdrachten } from "@/components/opdrachten-provider"
import { cn } from "@/lib/utils"
import { downloadFotos } from "@/lib/foto-download"
import { isFotograafItem, isVrijgegevenFotograaf, metUrls } from "@/lib/media"
import { OPDRACHTEN_OPEN } from "@/lib/bruiloft"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface Photo {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  challenge_id?: number | null
  user_id?: string | null
  in_fotoboek?: boolean
  media_type?: string | null
  bron?: string | null
  zichtbaar_dag?: boolean
  zichtbaar_avond?: boolean
  origineel_pad?: string | null
  origineel_naam?: string | null
  thumb_pad?: string | null
  url?: string // generated from storage_path
  thumb_url?: string
}

type Volgorde = "gemengd" | "nieuw" | "oud"

/**
 * Om de beurt een foto van iedere gast, zodat niet de laatste grote upload van
 * één persoon de hele bovenkant vult. Geen toeval: de volgorde ligt vast (en
 * blijft dus gelijk bij herladen en in de lightbox). Per gast blijft de eigen
 * volgorde (nieuwste eerst) bewaard; wie het laatst iets deelde, begint.
 */
function mengPerGast<T extends { uploaded_by: string }>(fotos: T[]): T[] {
  const perGast = new Map<string, T[]>()
  for (const f of fotos) {
    const lijst = perGast.get(f.uploaded_by)
    if (lijst) lijst.push(f)
    else perGast.set(f.uploaded_by, [f])
  }
  const rijen = [...perGast.values()]
  const uit: T[] = []
  for (let i = 0; uit.length < fotos.length; i++) {
    for (const rij of rijen) if (i < rij.length) uit.push(rij[i])
  }
  return uit
}

export default function SelectiePage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [activeTab, setActiveTab] = useState("alle")
  const [session, setSession] = useState<GuestSession | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  // Filter "van wie" in het tabblad Alle (leeg = iedereen).
  const [personen, setPersonen] = useState<Set<string>>(new Set())
  const [volgorde, setVolgorde] = useState<Volgorde>("gemengd")
  const opdrachten = useOpdrachten()

  // Selecteren + downloaden.
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [downloadVoortgang, setDownloadVoortgang] = useState<{ done: number; total: number } | null>(null)

  // Eigen foto verwijderen.
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPhotos = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("uploaded_at", { ascending: false })

    if (error) {
      console.error("Error fetching photos:", error)
    } else {
      // Fotograaf-foto's komen alleen mee als de database ze aan deze gast
      // toont (daggasten, na selectie in het beheer; zie migratie 019).
      setPhotos((data || []).map(photo => metUrls(supabase, photo as Photo)))
    }
    setIsLoading(false)
  }

  // Vanaf de homepage: ?upload=1 opent meteen het uploadvenster,
  // ?tab=fotograaf springt naar de foto's van de fotograaf.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("upload") === "1") setUploadOpen(true)
    const tab = params.get("tab")
    if (tab && ["alle", "opdrachten", "mijn", "fotograaf"].includes(tab)) setActiveTab(tab)
  }, [])

  useEffect(() => {
    fetchPhotos()
    getGuestSession().then(setSession)

    // Set up realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel("photos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photos" },
        () => {
          fetchPhotos()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Gastfoto's en de vrijgegeven foto's van de fotograaf apart. Ook beheer ziet
  // hier alleen wat daggasten zien; de rest staat in het beheer.
  const gastFotos = photos.filter(p => !isFotograafItem(p))
  // Fotograaf-foto's in cameravolgorde (bestandsnaam), zoals hij ze maakte.
  const fotograafFotos = photos
    .filter(p => isVrijgegevenFotograaf(p))
    .sort((a, b) =>
      (a.origineel_naam ?? "").localeCompare(b.origineel_naam ?? "", undefined, { numeric: true }),
    )
  const toonFotograaf = fotograafFotos.length > 0

  const opdrachtPhotos = gastFotos.filter(p => p.challenge_id != null)

  // Wie heeft er iets gedeeld, meeste foto's eerst.
  const perUploader = new Map<string, number>()
  for (const p of gastFotos) perUploader.set(p.uploaded_by, (perUploader.get(p.uploaded_by) ?? 0) + 1)
  const uploaders = [...perUploader.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const delers = uploaders.length

  // Opdracht-foto's gegroepeerd per opdracht (oplopend op opdrachtnummer).
  const perOpdracht = new Map<number, Photo[]>()
  for (const p of opdrachtPhotos) {
    const id = p.challenge_id as number
    if (!perOpdracht.has(id)) perOpdracht.set(id, [])
    perOpdracht.get(id)!.push(p)
  }
  const opdrachtGroepen = [...perOpdracht.entries()].sort(([a], [b]) => a - b)

  // Eigen foto's van de ingelogde gast: opdracht-foto's en algemene foto's.
  const mijnFotos = session ? gastFotos.filter(p => p.user_id === session.user_id) : []
  const mijnOpdrachtFotos = mijnFotos.filter(p => p.challenge_id != null)
  const mijnAlgemeneFotos = mijnFotos.filter(p => p.challenge_id == null)

  // Tabblad Alle: gemengd per gast (standaard), of op uploadtijd.
  const sorteer = (fotos: Photo[]) =>
    volgorde === "gemengd" ? mengPerGast(fotos) : volgorde === "oud" ? [...fotos].reverse() : fotos

  // Vlakke lijst per tab, zodat de lightbox in dezelfde volgorde bladert.
  const displayPhotos =
    activeTab === "opdrachten"
      ? opdrachtGroepen.flatMap(([, fotos]) => fotos)
      : activeTab === "mijn"
        ? [...mijnOpdrachtFotos, ...mijnAlgemeneFotos]
        : activeTab === "fotograaf"
          ? fotograafFotos
          : sorteer(personen.size > 0 ? gastFotos.filter(p => personen.has(p.uploaded_by)) : gastFotos)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const stopSelecteren = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const allesGeselecteerd = displayPhotos.length > 0 && displayPhotos.every((p) => selectedIds.has(p.id))
  const toggleAlles = () => {
    setSelectedIds((prev) => {
      if (allesGeselecteerd) {
        const next = new Set(prev)
        displayPhotos.forEach((p) => next.delete(p.id))
        return next
      }
      const next = new Set(prev)
      displayPhotos.forEach((p) => next.add(p.id))
      return next
    })
  }

  const downloadSelectie = async () => {
    const teDownloaden = photos.filter((p) => selectedIds.has(p.id))
    if (teDownloaden.length === 0) return
    setDownloadVoortgang({ done: 0, total: teDownloaden.length })
    try {
      const mislukt = await downloadFotos(teDownloaden, (done, total) =>
        setDownloadVoortgang({ done, total }),
      )
      if (mislukt > 0) toast.warning(`${teDownloaden.length - mislukt} gedownload, ${mislukt} mislukt`)
      else toast.success(`${teDownloaden.length} bestanden gedownload`)
      stopSelecteren()
    } catch (e) {
      console.error("Download mislukt", e)
      toast.error("Downloaden mislukt, probeer het opnieuw")
    } finally {
      setDownloadVoortgang(null)
    }
  }

  const confirmDeleteOwn = async () => {
    if (!photoToDelete) return
    setDeleting(true)
    const supabase = createClient()
    try {
      await supabase.storage
        .from("wedding-photos")
        .remove([photoToDelete.storage_path, photoToDelete.thumb_pad].filter((p): p is string => !!p))
      const { error } = await supabase.from("photos").delete().eq("id", photoToDelete.id)
      if (error) throw error
      toast.success("Foto verwijderd")
      setPhotoToDelete(null)
      fetchPhotos()
    } catch (e) {
      console.error("Verwijderen mislukt", e)
      toast.error("Verwijderen mislukt, probeer het opnieuw")
    } finally {
      setDeleting(false)
    }
  }

  // Gemeenschappelijke props voor elke PhotoGrid (selecteren + eigen verwijderen).
  const gridProps = {
    compact: true,
    selectionMode,
    selectedIds,
    onToggleSelect: toggleSelect,
    currentUserId: session?.user_id,
    onDeleteOwn: (photo: Photo) => setPhotoToDelete(photo),
  }

  const openUpload = () => {
    setUploadOpen(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <main className={cn("min-h-screen", selectionMode ? "pb-36" : "pb-20")}>
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-6">
        {/* Kop: kort, zodat de foto's snel in beeld zijn */}
        <header className="flex items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-bold text-foreground leading-tight">Fotogalerij</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Foto's laden…"
                : `${gastFotos.length} foto's & video's van ${delers} ${delers === 1 ? "gast" : "gasten"}`}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
            <Link href={activeTab === "fotograaf" ? "/diavoorstelling?bron=fotograaf" : "/diavoorstelling"}>
              <MonitorPlay className="w-4 h-4" />
              Diavoorstelling
            </Link>
          </Button>
        </header>

        {/* Delen: meerdere foto's en video's in één keer */}
        {session && (
          <div className="mb-4 rounded-2xl bg-primary/5 border border-primary/20 p-4">
            {!uploadOpen ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <p className="flex-1 min-w-0 text-sm text-foreground leading-snug">
                  <span className="font-medium">Nog iets moois op je telefoon?</span>{" "}
                  <span className="text-muted-foreground">Deel het hier met iedereen.</span>
                </p>
                <Button onClick={() => setUploadOpen(true)} className="gap-2 shrink-0">
                  <Plus className="w-4 h-4" />
                  Delen
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="font-medium text-foreground">Foto&apos;s &amp; video&apos;s delen</p>
                  <Button variant="ghost" size="sm" onClick={() => setUploadOpen(false)} className="gap-1">
                    <ChevronUp className="w-4 h-4" />
                    Sluiten
                  </Button>
                </div>
                <Suspense fallback={null}>
                  <PhotoUpload
                    directUploaden
                    videosToegestaan
                    guestName={session.name}
                    userId={session.user_id}
                    onUploadComplete={fetchPhotos}
                  />
                </Suspense>
              </>
            )}
          </div>
        )}

        {/* Tabs + filters blijven bovenin staan tijdens het scrollen */}
        <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 space-y-3">
          <Tabs
            value={activeTab}
            onValueChange={(t) => {
              setActiveTab(t)
              setPersonen(new Set())
            }}
          >
            <TabsList className={cn("grid w-full", toonFotograaf ? "grid-cols-4" : "grid-cols-3")}>
              <TabsTrigger value="alle">
                Alle <span className={toonFotograaf ? "hidden sm:inline ml-1" : "ml-1"}>({gastFotos.length})</span>
              </TabsTrigger>
              <TabsTrigger value="opdrachten">
                Opdrachten <span className={toonFotograaf ? "hidden sm:inline ml-1" : "ml-1"}>({opdrachtPhotos.length})</span>
              </TabsTrigger>
              <TabsTrigger value="mijn">
                Van mij <span className={toonFotograaf ? "hidden sm:inline ml-1" : "ml-1"}>({mijnFotos.length})</span>
              </TabsTrigger>
              {toonFotograaf && (
                <TabsTrigger value="fotograaf">
                  Fotograaf <span className="hidden sm:inline ml-1">({fotograafFotos.length})</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {!isLoading && displayPhotos.length > 0 && !selectionMode && (
            <div className="flex items-center justify-between gap-2">
              {/* Van wie: de foto's van één of meer gasten terugvinden */}
              {activeTab === "alle" && uploaders.length > 1 ? (
                <PersonenFilter
                  personen={uploaders}
                  totaal={gastFotos.length}
                  gekozen={personen}
                  onChange={setPersonen}
                />
              ) : (
                <p className="text-xs text-muted-foreground truncate">
                  {activeTab === "fotograaf"
                    ? "Door onze fotograaf — download je favorieten in volle kwaliteit"
                    : "Tik op een foto om hem groot te bekijken"}
                </p>
              )}
              {activeTab === "alle" && (
                <label className="relative shrink-0">
                  <span className="sr-only">Volgorde</span>
                  <select
                    value={volgorde}
                    onChange={(e) => setVolgorde(e.target.value as Volgorde)}
                    className="h-9 appearance-none rounded-md border border-border bg-card pl-2.5 pr-7 text-sm text-foreground"
                  >
                    <option value="gemengd">Gemengd</option>
                    <option value="nieuw">Nieuwste</option>
                    <option value="oud">Oudste</option>
                  </select>
                  <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                </label>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode(true)}
                className="gap-2 shrink-0"
                aria-label="Downloaden"
              >
                <Download className="w-4 h-4" />
                <span className={activeTab === "alle" ? "hidden sm:inline" : ""}>Downloaden</span>
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : activeTab === "opdrachten" ? (
          /* Per opdracht gegroepeerd: zo zie je wat er per opdracht is geüpload */
          opdrachtGroepen.length === 0 ? (
            <PhotoGrid photos={[]} onPhotoClick={setLightboxPhoto} {...gridProps} />
          ) : (
            <div className="space-y-6">
              {opdrachtGroepen.map(([id, fotos]) => (
                <section key={id}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-[11px] shrink-0">
                      {id}
                    </span>
                    <p className="text-sm text-foreground leading-snug pt-0.5">
                      {opdrachten.find((c) => c.id === id)?.text ?? `Opdracht ${id}`}{" "}
                      <span className="text-muted-foreground">({fotos.length})</span>
                    </p>
                  </div>
                  <PhotoGrid photos={fotos} onPhotoClick={setLightboxPhoto} toonOpdrachtBadge={false} {...gridProps} />
                </section>
              ))}
            </div>
          )
        ) : activeTab === "mijn" ? (
          /* Eigen uploads: opdracht-foto's (als je die hebt) en de rest */
          <div className="space-y-6">
            {(mijnOpdrachtFotos.length > 0 || OPDRACHTEN_OPEN) && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="font-medium text-foreground">
                    Voor opdrachten{" "}
                    <span className="text-muted-foreground font-normal">({mijnOpdrachtFotos.length})</span>
                  </h2>
                </div>
                {mijnOpdrachtFotos.length > 0 ? (
                  <PhotoGrid photos={mijnOpdrachtFotos} onPhotoClick={setLightboxPhoto} toonFotoboek {...gridProps} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nog geen opdracht-foto&apos;s — ga naar Opdrachten om te beginnen!
                  </p>
                )}
              </section>
            )}

            <section>
              {mijnOpdrachtFotos.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="font-medium text-foreground">
                    Foto&apos;s &amp; video&apos;s{" "}
                    <span className="text-muted-foreground font-normal">({mijnAlgemeneFotos.length})</span>
                  </h2>
                </div>
              )}
              {mijnAlgemeneFotos.length > 0 ? (
                <PhotoGrid photos={mijnAlgemeneFotos} onPhotoClick={setLightboxPhoto} toonFotoboek {...gridProps} />
              ) : (
                <div className="text-center py-12 space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Je hebt nog niets gedeeld.</p>
                  {session && (
                    <Button onClick={openUpload} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Deel je eerste foto&apos;s
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : (
          <PhotoGrid photos={displayPhotos} onPhotoClick={setLightboxPhoto} {...gridProps} />
        )}
      </div>

      {/* Selecteren: vaste balk onderin, boven het menu */}
      {selectionMode && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-card/95 backdrop-blur px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={stopSelecteren}
              disabled={downloadVoortgang !== null}
              aria-label="Stoppen met selecteren"
              className="px-2"
            >
              <X className="w-5 h-5" />
            </Button>
            <p className="flex-1 min-w-0 text-sm text-foreground truncate">
              {selectedIds.size === 0 ? "Tik op foto's om te kiezen" : `${selectedIds.size} gekozen`}
            </p>
            <Button variant="outline" size="sm" onClick={toggleAlles} className="gap-1.5">
              {allesGeselecteerd ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allesGeselecteerd ? "Geen" : "Alles"}
            </Button>
            <Button
              size="sm"
              onClick={downloadSelectie}
              disabled={selectedIds.size === 0 || downloadVoortgang !== null}
              className="gap-1.5"
            >
              {downloadVoortgang ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {downloadVoortgang.done}/{downloadVoortgang.total}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <Navigation />

      <PhotoLightbox
        photo={lightboxPhoto}
        photos={displayPhotos}
        onClose={() => setLightboxPhoto(null)}
        onNavigate={setLightboxPhoto}
      />

      <AlertDialog open={photoToDelete !== null} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Jouw foto verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze foto wordt definitief verwijderd en verdwijnt uit de galerij. Dit kan niet ongedaan
              worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDeleteOwn()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Verwijder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
