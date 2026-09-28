"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Shield,
  Loader2,
  LogOut,
  Images,
  Download,
  Trash2,
  CheckSquare,
  Square,
  QrCode,
  Printer,
  ClipboardList,
  MonitorPlay,
  BookOpen,
  Armchair,
  Target,
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppStatusSchakelaar } from "@/components/app-status-schakelaar"
import { GuestListManager } from "@/components/guest-list-manager"
import { OpdrachtenOverzicht } from "@/components/opdrachten-overzicht"
import { Navigation } from "@/components/navigation"
import { TafelIndeling } from "@/components/tafel-indeling"
import { PhotoGrid } from "@/components/photo-grid"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { FotograafBeheer } from "@/components/fotograaf-beheer"
import { createClient } from "@/lib/supabase/client"
import { downloadFotos } from "@/lib/foto-download"
import { maakThumbnail } from "@/lib/foto-upload"
import { isVideoItem, metUrls } from "@/lib/media"
import { toast } from "sonner"
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
  media_type?: string | null
  bron?: string | null
  thumb_pad?: string | null
  url?: string
  thumb_url?: string
}

export default function AdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [activeTab, setActiveTab] = useState("guests")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: "photo", id: string } | null>(null)

  const checkAuth = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push("/admin/login")
      return
    }

    setIsAuthenticated(true)
    setIsLoading(false)
  }, [router])

  const fetchPhotos = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("uploaded_at", { ascending: false })

    if (error) {
      console.error("Error fetching photos:", error)
    } else {
      // Fotograaf-foto's hebben hun eigen tabblad (FotograafBeheer).
      const photosWithUrls = (data || [])
        .filter(photo => photo.bron !== "fotograaf")
        .map(photo => metUrls(supabase, photo as Photo & { storage_path: string }))
      setPhotos(photosWithUrls)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) return

    fetchPhotos()

    const supabase = createClient()

    const photosChannel = supabase
      .channel("admin-photos-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, () => fetchPhotos())
      .subscribe()

    return () => {
      supabase.removeChannel(photosChannel)
    }
  }, [isAuthenticated])

  const handleLockBeheer = async () => {
    await fetch("/api/beheer", { method: "DELETE" })
    toast.success("Beheer vergrendeld")
    router.push("/")
    router.refresh()
  }

  const handleDeletePhoto = async (id: string) => {
    setItemToDelete({ type: "photo", id })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return
    const supabase = createClient()

    try {
      if (itemToDelete.type === "photo") {
        const photo = photos.find(p => p.id === itemToDelete.id)
        if (photo) {
          await supabase.storage
            .from("wedding-photos")
            .remove([photo.storage_path, photo.thumb_pad].filter((p): p is string => !!p))
          const { error } = await supabase.from("photos").delete().eq("id", itemToDelete.id)
          if (error) throw error
          toast.success("Foto verwijderd")
          fetchPhotos()
        }
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Verwijderen mislukt")
    } finally {
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const handleToggleSelection = async (id: string, selected: boolean) => {
    const supabase = createClient()
    const { error } = await supabase.from("photos").update({ is_selected: selected }).eq("id", id)
    if (error) {
      toast.error("Selectie aanpassen mislukt")
    } else {
      fetchPhotos()
    }
  }

  const handleBulkToggleSelection = async (select: boolean) => {
    if (selectedIds.size === 0) return
    const supabase = createClient()
    const { error } = await supabase.from("photos").update({ is_selected: select }).in("id", Array.from(selectedIds))
    if (error) {
      toast.error("Selectie aanpassen mislukt")
    } else {
      toast.success(`${selectedIds.size} foto's ${select ? "geselecteerd" : "gedeselecteerd"}`)
      setSelectedIds(new Set())
      setSelectionMode(false)
      fetchPhotos()
    }
  }

  // Oudere gastfoto's hebben nog geen thumbnail: die maken we hier achteraf,
  // zodat de galerij op telefoons niet honderden grote foto's hoeft te laden.
  const [thumbVoortgang, setThumbVoortgang] = useState<{ klaar: number; totaal: number } | null>(null)
  const zonderThumb = photos.filter(p => !p.thumb_pad && !isVideoItem(p))

  const maakThumbnails = async () => {
    const lijst = zonderThumb
    if (lijst.length === 0) return
    setThumbVoortgang({ klaar: 0, totaal: lijst.length })
    let klaar = 0
    let mislukt = 0
    let volgende = 0
    const werker = async () => {
      while (volgende < lijst.length) {
        const foto = lijst[volgende++]
        try {
          await maakThumbnail(foto)
        } catch (e) {
          console.error("Thumbnail mislukt", foto.storage_path, e)
          mislukt++
        }
        klaar++
        setThumbVoortgang({ klaar, totaal: lijst.length })
      }
    }
    await Promise.all([werker(), werker(), werker()])
    setThumbVoortgang(null)
    if (mislukt > 0) toast.warning(`${lijst.length - mislukt} thumbnails gemaakt, ${mislukt} mislukt`)
    else toast.success(`${lijst.length} thumbnails gemaakt — de galerij laadt nu veel sneller`)
    fetchPhotos()
  }

  const handleDownloadSelected = async () => {
    const selectedPhotos = photos.filter(p => selectedIds.has(p.id))
    toast.info(`${selectedPhotos.length} bestanden worden in een zip gezet…`)
    try {
      const mislukt = await downloadFotos(selectedPhotos)
      if (mislukt > 0) toast.warning(`${mislukt} bestand(en) konden niet worden opgehaald`)
    } catch (e) {
      console.error("Download mislukt", e)
      toast.error("Downloaden mislukt")
    }
  }

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const selectedPhotos = photos.filter(p => p.is_selected)

  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">Beheer Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {photos.length} foto's/video's, {selectedPhotos.length} geselecteerd
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/draaiboek")} className="gap-2 bg-transparent">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Draaiboek</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/diavoorstelling")} className="gap-2 bg-transparent">
              <MonitorPlay className="w-4 h-4" />
              <span className="hidden sm:inline">Diavoorstelling</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/kaartjes")} className="gap-2 bg-transparent">
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Kaartjes</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/qr")} className="gap-2 bg-transparent">
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">QR-code</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLockBeheer} className="gap-2 bg-transparent">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Vergrendel beheer</span>
            </Button>
          </div>
        </header>

        <AppStatusSchakelaar />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="guests" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Gastenlijst</span>
            </TabsTrigger>
            <TabsTrigger value="tafels" className="gap-2">
              <Armchair className="w-4 h-4" />
              <span className="hidden sm:inline">Tafels</span>
            </TabsTrigger>
            <TabsTrigger value="opdrachten" className="gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Opdrachten</span>
            </TabsTrigger>
            <TabsTrigger value="photos" className="gap-2">
              <Images className="w-4 h-4" />
              <span className="hidden sm:inline">Foto's</span>
              <span>({photos.length})</span>
            </TabsTrigger>
            <TabsTrigger value="fotograaf" className="gap-2">
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Fotograaf</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guests">
            <GuestListManager />
          </TabsContent>

          <TabsContent value="tafels">
            <TafelIndeling />
          </TabsContent>

          <TabsContent value="opdrachten">
            <OpdrachtenOverzicht />
          </TabsContent>

          <TabsContent value="photos">
            {zonderThumb.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  {thumbVoortgang
                    ? `Thumbnails maken… ${thumbVoortgang.klaar} van ${thumbVoortgang.totaal} (houd dit tabblad open)`
                    : `${zonderThumb.length} foto's hebben nog geen kleine versie; daardoor laadt de galerij traag op telefoons.`}
                </p>
                <Button size="sm" onClick={maakThumbnails} disabled={thumbVoortgang !== null} className="gap-2">
                  {thumbVoortgang ? <Loader2 className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />}
                  Thumbnails maken
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                variant={selectionMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectionMode(!selectionMode)
                  setSelectedIds(new Set())
                }}
                className="gap-2"
              >
                {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectionMode ? "Annuleer" : "Selecteer"}
              </Button>

              {selectionMode && selectedIds.size > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleBulkToggleSelection(true)} className="gap-2">
                    Markeer geselecteerd
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkToggleSelection(false)} className="gap-2">
                    Deselecteer
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadSelected} className="gap-2 bg-transparent">
                    <Download className="w-4 h-4" />
                    Download ({selectedIds.size})
                  </Button>
                </>
              )}
            </div>

            <PhotoGrid
              photos={photos}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectId}
              onPhotoClick={selectionMode ? undefined : setLightboxPhoto}
              isAdmin={!selectionMode}
              onDelete={handleDeletePhoto}
              onToggleSelection={handleToggleSelection}
            />
          </TabsContent>

          <TabsContent value="fotograaf">
            <FotograafBeheer />
          </TabsContent>
        </Tabs>
      </div>

      <Navigation />

      <PhotoLightbox
        photo={lightboxPhoto}
        photos={photos}
        onClose={() => setLightboxPhoto(null)}
        onNavigate={setLightboxPhoto}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === "photo" && "Deze foto wordt permanent verwijderd."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="w-4 h-4 mr-2" />
              Verwijder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
