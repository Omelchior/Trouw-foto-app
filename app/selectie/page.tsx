"use client"

import { Suspense, useState, useEffect } from "react"
import { Images, Loader2, Camera, ChevronUp, Heart, Target } from "lucide-react"
import { PhotoGrid } from "@/components/photo-grid"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { PhotoUpload } from "@/components/photo-upload"
import { Navigation } from "@/components/navigation"
import { LogoutButton } from "@/components/logout-button"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getGuestSession, getChallenge, type GuestSession } from "@/lib/guest"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Photo {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  challenge_id?: number | null
  user_id?: string | null
  in_fotoboek?: boolean
  url?: string // generated from storage_path
}

export default function SelectiePage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [activeTab, setActiveTab] = useState("alle")
  const [session, setSession] = useState<GuestSession | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

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

  const opdrachtPhotos = photos.filter(p => p.challenge_id != null)

  // Opdracht-foto's gegroepeerd per opdracht (oplopend op opdrachtnummer).
  const perOpdracht = new Map<number, Photo[]>()
  for (const p of opdrachtPhotos) {
    const id = p.challenge_id as number
    if (!perOpdracht.has(id)) perOpdracht.set(id, [])
    perOpdracht.get(id)!.push(p)
  }
  const opdrachtGroepen = [...perOpdracht.entries()].sort(([a], [b]) => a - b)

  // Eigen foto's van de ingelogde gast: opdracht-foto's en algemene foto's.
  const mijnFotos = session ? photos.filter(p => p.user_id === session.user_id) : []
  const mijnOpdrachtFotos = mijnFotos.filter(p => p.challenge_id != null)
  const mijnAlgemeneFotos = mijnFotos.filter(p => p.challenge_id == null)

  // Vlakke lijst per tab, zodat de lightbox in dezelfde volgorde bladert.
  const displayPhotos =
    activeTab === "opdrachten"
      ? opdrachtGroepen.flatMap(([, fotos]) => fotos)
      : activeTab === "mijn"
        ? [...mijnOpdrachtFotos, ...mijnAlgemeneFotos]
        : photos

  return (
    <main className="min-h-screen pb-20">
      {/* Admin access button - top right */}
      <div className="absolute top-4 right-4 z-10">
        <LogoutButton />
      </div>

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

        {/* Snelle upload: meerdere foto's van de hele dag, zonder fotoboek-stap */}
        {session && (
          <div className="mb-6">
            <Button
              variant={uploadOpen ? "outline" : "default"}
              className="w-full h-12 text-base gap-2"
              onClick={() => setUploadOpen((v) => !v)}
            >
              {uploadOpen ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  Upload verbergen
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Foto&apos;s uploaden
                </>
              )}
            </Button>
            {uploadOpen && (
              <div className="mt-4">
                <Suspense fallback={null}>
                  <PhotoUpload
                    directUploaden
                    guestName={session.name}
                    userId={session.user_id}
                    onUploadComplete={fetchPhotos}
                  />
                </Suspense>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="alle">
              Alle ({photos.length})
            </TabsTrigger>
            <TabsTrigger value="opdrachten">
              Opdrachten ({opdrachtPhotos.length})
            </TabsTrigger>
            <TabsTrigger value="mijn">
              Van mij ({mijnFotos.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : activeTab === "opdrachten" ? (
          /* Per opdracht gegroepeerd: zo zie je wat er per opdracht is geüpload */
          opdrachtGroepen.length === 0 ? (
            <PhotoGrid photos={[]} onPhotoClick={setLightboxPhoto} />
          ) : (
            <div className="space-y-8">
              {opdrachtGroepen.map(([id, fotos]) => (
                <section key={id}>
                  <div className="flex items-start gap-2 mb-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs shrink-0">
                      {id}
                    </span>
                    <p className="text-sm text-foreground pt-1">
                      {getChallenge(id)?.text ?? `Opdracht ${id}`}{" "}
                      <span className="text-muted-foreground">({fotos.length})</span>
                    </p>
                  </div>
                  <PhotoGrid photos={fotos} onPhotoClick={setLightboxPhoto} />
                </section>
              ))}
            </div>
          )
        ) : activeTab === "mijn" ? (
          /* Eigen uploads: opdracht-foto's en algemene foto's apart */
          <div className="space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary shrink-0" />
                <h2 className="font-medium text-foreground">
                  Voor opdrachten{" "}
                  <span className="text-muted-foreground font-normal">
                    ({mijnOpdrachtFotos.length})
                  </span>
                </h2>
              </div>
              {mijnOpdrachtFotos.length > 0 ? (
                <PhotoGrid photos={mijnOpdrachtFotos} onPhotoClick={setLightboxPhoto} toonFotoboek />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nog geen opdracht-foto&apos;s — ga naar Opdrachten om te beginnen!
                </p>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-primary shrink-0" />
                <h2 className="font-medium text-foreground">
                  Algemene foto&apos;s{" "}
                  <span className="text-muted-foreground font-normal">
                    ({mijnAlgemeneFotos.length})
                  </span>
                </h2>
              </div>
              {mijnAlgemeneFotos.length > 0 ? (
                <PhotoGrid photos={mijnAlgemeneFotos} onPhotoClick={setLightboxPhoto} toonFotoboek />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nog geen algemene foto&apos;s — deel je mooiste momenten van vandaag!
                </p>
              )}
            </section>

            {mijnFotos.length > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Heart className="w-3 h-3 fill-current text-primary" />
                = door jou gekozen voor het fotoboek
              </p>
            )}
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
