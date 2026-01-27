"use client"

import { useState, useEffect } from "react"
import { Images, Loader2 } from "lucide-react"
import { PhotoGrid } from "@/components/photo-grid"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { Navigation } from "@/components/navigation"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Photo {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  url?: string // generated from storage_path
}

export default function SelectiePage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [activeTab, setActiveTab] = useState("alle")

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
    setIsLoading(false)
  }

  useEffect(() => {
    fetchPhotos()
    
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

  const selectedPhotos = photos.filter(p => p.is_selected)
  const displayPhotos = activeTab === "geselecteerd" ? selectedPhotos : photos

  return (
    <main className="min-h-screen pb-20">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Images className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Fotogalerij
          </h1>
          <p className="text-muted-foreground">
            Alle foto's van de bruiloft
          </p>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="alle">
              Alle ({photos.length})
            </TabsTrigger>
            <TabsTrigger value="geselecteerd">
              Geselecteerd ({selectedPhotos.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <PhotoGrid
            photos={displayPhotos}
            onPhotoClick={setLightboxPhoto}
          />
        )}
      </div>

      <Navigation />

      <PhotoLightbox
        photo={lightboxPhoto}
        photos={displayPhotos}
        onClose={() => setLightboxPhoto(null)}
        onNavigate={setLightboxPhoto}
      />
    </main>
  )
}
