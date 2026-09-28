"use client"

import { useEffect, useRef, useState } from "react"
import { X, ChevronLeft, ChevronRight, Heart, Download, Target, Loader2, Aperture } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOpdrachten } from "@/components/opdrachten-provider"
import { downloadFoto } from "@/lib/foto-download"
import { isFotograafItem, isVideoItem } from "@/lib/media"
import { toast } from "sonner"

interface Photo {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  challenge_id?: number | null
  media_type?: string | null
  bron?: string | null
  url?: string
}

interface PhotoLightboxProps {
  photo: Photo | null
  photos: Photo[]
  onClose: () => void
  onNavigate: (photo: Photo) => void
  /** Toon "Geselecteerd" (voor de diavoorstelling); alleen in het beheer. */
  toonSelectie?: boolean
}

/** Minimale veegafstand (px) om naar de vorige/volgende foto te gaan. */
const SWIPE_PX = 50

export function PhotoLightbox({ photo, photos, onClose, onNavigate, toonSelectie = false }: PhotoLightboxProps) {
  const currentIndex = photo ? photos.findIndex(p => p.id === photo.id) : -1
  const [downloading, setDownloading] = useState(false)
  const opdrachten = useOpdrachten()
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const vorige = currentIndex > 0 ? photos[currentIndex - 1] : null
  const volgende = currentIndex >= 0 && currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null

  const handleDownload = async () => {
    if (!photo || downloading) return
    setDownloading(true)
    try {
      await downloadFoto(photo)
    } catch (e) {
      console.error("Download mislukt", e)
      toast.error("Downloaden mislukt, probeer het opnieuw")
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (!photo) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft" && vorige) onNavigate(vorige)
      else if (e.key === "ArrowRight" && volgende) onNavigate(volgende)
    }

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [photo, vorige, volgende, onClose, onNavigate])

  if (!photo) return null

  const video = isVideoItem(photo)
  const opdrachtTekst =
    photo.challenge_id != null
      ? (opdrachten.find(c => c.id === photo.challenge_id)?.text ?? `Opdracht ${photo.challenge_id}`)
      : null

  // Vegen op de telefoon: links = volgende, rechts = vorige, omlaag = sluiten.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && volgende) onNavigate(volgende)
      else if (dx > 0 && vorige) onNavigate(vorige)
    } else if (dy > SWIPE_PX * 2 && Math.abs(dy) > Math.abs(dx)) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onTouchStart={video ? undefined : onTouchStart}
      onTouchEnd={video ? undefined : onTouchEnd}
    >
      {/* Bovenbalk: teller + sluiten */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="text-sm text-white/70 tabular-nums pl-2">
          {currentIndex + 1} / {photos.length}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full"
          onClick={onClose}
          aria-label="Sluiten"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Pijltjes (desktop; op de telefoon veeg je) */}
      {vorige && (
        <Button
          size="icon"
          variant="ghost"
          className="hidden sm:flex absolute left-4 z-10 text-white hover:bg-white/20 rounded-full"
          onClick={() => onNavigate(vorige)}
          aria-label="Vorige"
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}
      {volgende && (
        <Button
          size="icon"
          variant="ghost"
          className="hidden sm:flex absolute right-4 z-10 text-white hover:bg-white/20 rounded-full"
          onClick={() => onNavigate(volgende)}
          aria-label="Volgende"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}

      {/* Foto of video */}
      <div className="w-full h-full flex items-center justify-center px-2 sm:px-16 pt-14 pb-32">
        {video ? (
          <video
            key={photo.id}
            src={photo.url}
            className="max-w-full max-h-full rounded-lg bg-black"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img
            key={photo.id}
            src={photo.url || "/placeholder.svg"}
            alt={`Foto van ${photo.uploaded_by}`}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            draggable={false}
          />
        )}
      </div>

      {/* Onderbalk: wie, welke opdracht, downloaden */}
      <div className="absolute bottom-0 inset-x-0 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 to-transparent">
        <div className="max-w-lg mx-auto flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="flex items-center gap-1.5 text-white font-medium">
              {isFotograafItem(photo) && <Aperture className="w-4 h-4 shrink-0" />}
              <span className="truncate">{photo.uploaded_by}</span>
            </p>
            {opdrachtTekst && (
              <p className="flex items-start gap-1 text-sm text-white/80 leading-snug">
                <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-3">
                  #{photo.challenge_id}: {opdrachtTekst}
                </span>
              </p>
            )}
            {toonSelectie && photo.is_selected && (
              <span className="inline-flex items-center gap-1 text-sm text-accent">
                <Heart className="w-3 h-3 fill-current" />
                Geselecteerd
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 shrink-0"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </Button>
        </div>
      </div>
    </div>
  )
}
