"use client"

import { useEffect } from "react"
import { X, ChevronLeft, ChevronRight, Heart, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Photo {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  url?: string
}

interface PhotoLightboxProps {
  photo: Photo | null
  photos: Photo[]
  onClose: () => void
  onNavigate: (photo: Photo) => void
}

export function PhotoLightbox({ photo, photos, onClose, onNavigate }: PhotoLightboxProps) {
  const currentIndex = photo ? photos.findIndex(p => p.id === photo.id) : -1

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!photo) return
      
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        onNavigate(photos[currentIndex - 1])
      } else if (e.key === "ArrowRight" && currentIndex < photos.length - 1) {
        onNavigate(photos[currentIndex + 1])
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [photo, photos, currentIndex, onClose, onNavigate])

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center">
      {/* Close button */}
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-4 right-4 text-primary-foreground hover:bg-card/20 z-10"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Navigation buttons */}
      {currentIndex > 0 && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-4 text-primary-foreground hover:bg-card/20"
          onClick={() => onNavigate(photos[currentIndex - 1])}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}
      {currentIndex < photos.length - 1 && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-4 text-primary-foreground hover:bg-card/20"
          onClick={() => onNavigate(photos[currentIndex + 1])}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}

      {/* Image */}
      <div className="max-w-full max-h-full p-4">
        <img
          src={photo.url || "/placeholder.svg"}
          alt={`Foto van ${photo.uploaded_by}`}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
      </div>

      {/* Info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-foreground/80 to-transparent">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-primary-foreground font-medium">{photo.uploaded_by}</p>
            {photo.is_selected && (
              <span className="inline-flex items-center gap-1 text-sm text-accent">
                <Heart className="w-3 h-3 fill-current" />
                Geselecteerd
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={() => window.open(photo.url, '_blank')}
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>
    </div>
  )
}
