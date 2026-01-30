"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { 
  Shield, 
  Loader2, 
  LogOut, 
  Images, 
  MessageCircle, 
  Download,
  Trash2,
  CheckSquare,
  Square
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PhotoGrid } from "@/components/photo-grid"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { GuestbookFeed } from "@/components/guestbook-feed"
import { createClient } from "@/lib/supabase/client"
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
  url?: string
}

interface GuestbookEntry {
  id: string
  guest_name: string
  message: string
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([])
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [activeTab, setActiveTab] = useState("photos")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: "photo" | "guestbook", id: string } | null>(null)

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
      // Generate public URLs from storage paths
      const photosWithUrls = (data || []).map(photo => ({
        ...photo,
        url: supabase.storage.from("wedding-photos").getPublicUrl(photo.storage_path).data.publicUrl
      }))
      setPhotos(photosWithUrls)
    }
  }

  const fetchGuestbook = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("guestbook_entries")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching guestbook:", error)
    } else {
      setGuestbookEntries(data || [])
    }
  }

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (isAuthenticated) {
      fetchPhotos()
      fetchGuestbook()

      // Set up realtime subscriptions for live updates
      const supabase = createClient()
      
      const photosChannel = supabase
        .channel("admin-photos-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "photos" },
          () => {
            fetchPhotos()
          }
        )
        .subscribe()

      const guestbookChannel = supabase
        .channel("admin-guestbook-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "guestbook_entries" },
          () => {
            fetchGuestbook()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(photosChannel)
        supabase.removeChannel(guestbookChannel)
      }
    }
  }, [isAuthenticated])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  const handleDeletePhoto = async (id: string) => {
    setItemToDelete({ type: "photo", id })
    setDeleteDialogOpen(true)
  }

  const handleDeleteGuestbook = async (id: string) => {
    setItemToDelete({ type: "guestbook", id })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return

    const supabase = createClient()
    
    try {
      if (itemToDelete.type === "photo") {
        const photo = photos.find(p => p.id === itemToDelete.id)
        if (photo) {
          // Delete from storage
          await supabase.storage
            .from("wedding-photos")
            .remove([photo.storage_path])
          
          // Delete from database
          const { error } = await supabase
            .from("photos")
            .delete()
            .eq("id", itemToDelete.id)

          if (error) throw error
          toast.success("Foto verwijderd")
          fetchPhotos()
        }
      } else {
        const { error } = await supabase
          .from("guestbook_entries")
          .delete()
          .eq("id", itemToDelete.id)

        if (error) throw error
        toast.success("Bericht verwijderd")
        fetchGuestbook()
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
    
    const { error } = await supabase
      .from("photos")
      .update({ is_selected: selected })
      .eq("id", id)

    if (error) {
      console.error("Toggle selection error:", error)
      toast.error("Selectie aanpassen mislukt")
    } else {
      fetchPhotos()
    }
  }

  const handleBulkToggleSelection = async (select: boolean) => {
    if (selectedIds.size === 0) return

    const supabase = createClient()
    
    const { error } = await supabase
      .from("photos")
      .update({ is_selected: select })
      .in("id", Array.from(selectedIds))

    if (error) {
      console.error("Bulk toggle error:", error)
      toast.error("Selectie aanpassen mislukt")
    } else {
      toast.success(`${selectedIds.size} foto's ${select ? "geselecteerd" : "gedeselecteerd"}`)
      setSelectedIds(new Set())
      setSelectionMode(false)
      fetchPhotos()
    }
  }

  const handleDownloadSelected = () => {
    const selectedPhotos = photos.filter(p => selectedIds.has(p.id))
    selectedPhotos.forEach(photo => {
      window.open(photo.url, '_blank')
    })
  }

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
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

  if (!isAuthenticated) {
    return null
  }

  const selectedPhotos = photos.filter(p => p.is_selected)

  return (
    <main className="min-h-screen pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {photos.length} foto's, {selectedPhotos.length} geselecteerd
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 bg-transparent">
            <LogOut className="w-4 h-4" />
            Uitloggen
          </Button>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="photos" className="gap-2">
              <Images className="w-4 h-4" />
              Foto's ({photos.length})
            </TabsTrigger>
            <TabsTrigger value="guestbook" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Gastenboek ({guestbookEntries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos">
            {/* Photo toolbar */}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkToggleSelection(true)}
                    className="gap-2"
                  >
                    Markeer geselecteerd
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkToggleSelection(false)}
                    className="gap-2"
                  >
                    Deselecteer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadSelected}
                    className="gap-2 bg-transparent"
                  >
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

          <TabsContent value="guestbook">
            <GuestbookFeed
              entries={guestbookEntries}
              isAdmin
              onDelete={handleDeleteGuestbook}
            />
          </TabsContent>
        </Tabs>
      </div>

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
              {itemToDelete?.type === "photo"
                ? "Deze foto wordt permanent verwijderd."
                : "Dit bericht wordt permanent verwijderd."
              }
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
