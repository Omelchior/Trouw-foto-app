"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Check, ChevronLeft, ChevronRight, Loader2, PartyPopper, Target, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { markChallengeCompleted, getChallenge, volgendeOpdracht, CHALLENGES } from "@/lib/guest"
import { uploadFoto, MAX_FILE_SIZE } from "@/lib/foto-upload"

export interface OpdrachtFoto {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  challenge_id?: number | null
  url?: string
}

interface OpdrachtCarouselProps {
  userId: string
  guestName: string
  completed: number[]
  /** Opdracht die via de gastenlijst aan deze gast is gekoppeld. */
  eersteOpdracht: number | null
  photosByChallenge: Record<number, OpdrachtFoto>
  /** Sessie en foto's opnieuw laden na een geslaagde upload. */
  onChanged: () => void
}

const KAART = "w-[80%] max-w-sm shrink-0 snap-center"

/**
 * Swipebare kaarten: links de voltooide opdrachten met hun foto, dan de
 * actieve opdracht met upload-venster, en na afronden rechts de kaart om
 * nog een opdracht te doen.
 */
export function OpdrachtCarousel({
  userId,
  guestName,
  completed,
  eersteOpdracht,
  photosByChallenge,
  onChanged,
}: OpdrachtCarouselProps) {
  // Opdracht die de gast zelf via "nog een opdracht" heeft gekozen.
  const [gekozen, setGekozen] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<OpdrachtFoto | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const completedSet = new Set(completed)
  const actief =
    eersteOpdracht != null && !completedSet.has(eersteOpdracht)
      ? eersteOpdracht
      : gekozen != null && !completedSet.has(gekozen)
        ? gekozen
        : null
  const actieveOpdracht = actief != null ? getChallenge(actief) : null

  // Voltooide opdrachten in de volgorde waarin de foto's zijn geüpload.
  const voltooid = [...completed].sort((a, b) => {
    const ta = photosByChallenge[a]?.uploaded_at ?? ""
    const tb = photosByChallenge[b]?.uploaded_at ?? ""
    return ta.localeCompare(tb) || a - b
  })
  const voltooideFotos = voltooid
    .map((id) => photosByChallenge[id])
    .filter(Boolean) as OpdrachtFoto[]

  const allesGedaan = completed.length >= CHALLENGES.length

  // Start (en na elke verandering) bij de actieve kaart rechts, met de
  // laatste foto er deels naast.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" })
  }, [voltooid.length, actief])

  const kiesFoto = (viaCamera: boolean) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    if (viaCamera) input.capture = "environment"
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      if (f.size > MAX_FILE_SIZE) {
        toast.error("Foto te groot (max 10MB)")
        return
      }
      setFile(f)
      const reader = new FileReader()
      reader.onload = () => setPreview(reader.result as string)
      reader.readAsDataURL(f)
    }
    input.click()
  }

  const upload = async () => {
    if (!file || actief == null) return
    setUploading(true)
    try {
      await uploadFoto({ file, guestName, userId, challengeId: actief })
      await markChallengeCompleted(actief)
      toast.success(`Opdracht #${actief} afgevinkt! 🎉`)
      setFile(null)
      setPreview(null)
      onChanged()
    } catch (e) {
      console.error("Upload error", e)
      toast.error("Uploaden mislukt, probeer het opnieuw")
    } finally {
      setUploading(false)
    }
  }

  const nogEenOpdracht = () => {
    const volgende = volgendeOpdracht(completed, actief)
    if (volgende) setGekozen(volgende.id)
  }

  const scrollBij = (richting: -1 | 1) => {
    const el = scrollRef.current
    if (el) el.scrollBy({ left: richting * el.clientWidth * 0.8, behavior: "smooth" })
  }

  return (
    <>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* Voltooide opdrachten met hun foto */}
          {voltooid.map((id) => {
            const opdracht = getChallenge(id)
            const photo = photosByChallenge[id]

            if (!photo) {
              return (
                <div
                  key={id}
                  className={`${KAART} aspect-[3/4] rounded-xl border-2 border-primary bg-primary/10 p-4 flex flex-col justify-between`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-primary/80">#{id}</span>
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">{opdracht?.text}</p>
                </div>
              )
            }

            return (
              <button
                key={id}
                onClick={() => setLightbox(photo)}
                aria-label={`Foto voor opdracht ${id}: ${opdracht?.text ?? ""}`}
                className={`${KAART} relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-primary`}
              >
                <img
                  src={photo.url || "/placeholder.svg"}
                  alt={opdracht?.text ?? `Opdracht ${id}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-foreground/30" />
                <div className="absolute top-2 left-2 text-xs font-bold text-white bg-primary/90 rounded px-1.5 py-0.5">
                  #{id}
                </div>
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
                </div>
                <p className="absolute bottom-3 inset-x-3 text-left text-sm text-white line-clamp-2">
                  {opdracht?.text}
                </p>
              </button>
            )
          })}

          {/* Actieve opdracht met upload-venster */}
          {actieveOpdracht ? (
            <div className={`${KAART} border border-border rounded-xl overflow-hidden flex flex-col bg-card`}>
              <div className="bg-primary/10 border-b border-primary/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                    {actieveOpdracht.id}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-primary font-medium uppercase tracking-wide mb-0.5">
                      {actief === eersteOpdracht ? "Jouw foto-opdracht" : "Foto-opdracht"}
                    </p>
                    <p className="text-sm text-foreground">{actieveOpdracht.text}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-center gap-3">
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="Gekozen foto"
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    <Button
                      onClick={() => kiesFoto(false)}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={uploading}
                    >
                      <Upload className="w-4 h-4" />
                      Andere foto kiezen
                    </Button>
                    <Button onClick={upload} disabled={uploading} className="h-11 gap-2">
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Uploaden
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="mx-auto w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                      <Camera className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-center text-sm font-medium">
                      Maak of kies één foto voor deze opdracht
                    </p>
                    <Button onClick={() => kiesFoto(true)} className="h-11 gap-2">
                      <Camera className="w-5 h-5" />
                      Maak een foto
                    </Button>
                    <Button onClick={() => kiesFoto(false)} variant="outline" className="h-11 gap-2">
                      <Upload className="w-5 h-5" />
                      Kies uit je galerij
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Alles wat klaar is: kaart voor de volgende opdracht */
            <div
              className={`${KAART} min-h-[18rem] border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center`}
            >
              {allesGedaan ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <PartyPopper className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-serif text-lg font-bold">Wauw, alles voltooid!</p>
                  <p className="text-sm text-muted-foreground">
                    Je hebt álle {CHALLENGES.length} opdrachten gedaan. 🎉
                  </p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Target className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-medium">Zin in nog een opdracht?</p>
                  <p className="text-sm text-muted-foreground">
                    Je krijgt een willekeurige opdracht die je nog niet hebt gedaan.
                  </p>
                  <Button onClick={nogEenOpdracht} className="h-11 gap-2">
                    <Target className="w-5 h-5" />
                    Geef me een opdracht!
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Pijltjes voor wie niet swipet (desktop) */}
        {voltooid.length > 0 && (
          <>
            <button
              onClick={() => scrollBij(-1)}
              aria-label="Vorige"
              className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-9 h-9 rounded-full bg-card border border-border shadow items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollBij(1)}
              aria-label="Volgende"
              className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-9 h-9 rounded-full bg-card border border-border shadow items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <PhotoLightbox
        photo={lightbox}
        photos={voltooideFotos}
        onClose={() => setLightbox(null)}
        onNavigate={setLightbox}
      />
    </>
  )
}
