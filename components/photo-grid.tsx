"use client"

import { useState } from "react"
import { Heart, Check, X, Download, Loader2, Trash2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadFoto } from "@/lib/foto-download"
import { isVideoItem } from "@/lib/media"
import { cn } from "@/lib/utils"

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
  url?: string
  /** Kleine versie voor het grid (fotograaf-foto's); anders `url`. */
  thumb_url?: string
}

interface PhotoGridProps {
  photos: Photo[]
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onPhotoClick?: (photo: Photo) => void
  isAdmin?: boolean
  onDelete?: (id: string) => void
  onToggleSelection?: (id: string, selected: boolean) => void
  /** Toon een hartje op foto's die de gast voor het fotoboek heeft gekozen. */
  toonFotoboek?: boolean
  /** De ingelogde gast; nodig om diens eigen foto's een verwijderknop te geven. */
  currentUserId?: string
  /** Gast verwijdert een eigen foto (met bevestiging door de pagina). */
  onDeleteOwn?: (photo: Photo) => void
  /**
   * Compact "camerarol": meer foto's per rij, kleine tussenruimte en geen naam
   * op de tegel (die staat in de lightbox). Voor de galerij op de telefoon.
   */
  compact?: boolean
  /** Opdrachtnummer op de tegel (uit als de opdracht al als kop boven de foto's staat). */
  toonOpdrachtBadge?: boolean
}

export function PhotoGrid({
  photos,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  onPhotoClick,
  isAdmin = false,
  onDelete,
  onToggleSelection,
  toonFotoboek = false,
  currentUserId,
  onDeleteOwn,
  compact = false,
  toonOpdrachtBadge = true,
}: PhotoGridProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

  const handleAction = async (id: string, action: () => Promise<void>) => {
    setLoadingStates(prev => ({ ...prev, [id]: true }))
    try {
      await action()
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }))
    }
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Heart className="w-10 h-10 text-muted-foreground" />
        </div>
        <p className="text-lg text-muted-foreground">Nog niets geüpload</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "grid",
        compact ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3",
      )}
    >
      {photos.map((photo) => (
        <div
          key={photo.id}
          className={cn(
            "relative aspect-square group cursor-pointer",
            selectionMode && selectedIds.has(photo.id) && !compact && "ring-4 ring-primary rounded-lg"
          )}
          onClick={() => {
            if (selectionMode && onToggleSelect) {
              onToggleSelect(photo.id)
            } else if (onPhotoClick) {
              onPhotoClick(photo)
            }
          }}
        >
          {isVideoItem(photo) ? (
            <>
              {/* #t=0.1 dwingt browsers een echt beeldje te laten zien i.p.v. zwart */}
              <video
                src={`${photo.url}#t=0.1`}
                className={cn("w-full h-full object-cover bg-secondary", compact ? "rounded-md" : "rounded-lg")}
                muted
                playsInline
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-10 h-10 rounded-full bg-foreground/50 text-white flex items-center justify-center backdrop-blur-sm">
                  <Play className="w-5 h-5 fill-current" />
                </span>
              </div>
            </>
          ) : (
            <img
              src={photo.thumb_url || photo.url || "/placeholder.svg"}
              alt={`Foto van ${photo.uploaded_by}`}
              className={cn("w-full h-full object-cover bg-secondary", compact ? "rounded-md" : "rounded-lg")}
              loading="lazy"
            />
          )}
          
          {/* Overlay with uploader name (altijd zichtbaar; hover werkt niet op telefoons) */}
          {!compact && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent p-3 rounded-b-lg">
            <p className="text-sm text-primary-foreground font-medium truncate">
              {photo.uploaded_by}
            </p>
          </div>
          )}

          {/* Opdracht-badge */}
          {toonOpdrachtBadge && photo.challenge_id != null && !photo.is_selected && !selectionMode && (
            <div className="absolute top-2 left-2 text-[10px] sm:text-xs font-bold text-white bg-primary/90 rounded px-1.5 py-0.5">
              #{photo.challenge_id}
            </div>
          )}

          {/* Rechtsboven (gastweergave): fotoboek-hartje + verwijderknop voor
              eigen foto's. Altijd zichtbaar, want hover werkt niet op telefoons. */}
          {!selectionMode && !isAdmin && (
            <div className="absolute top-2 right-2 flex items-center gap-1">
              {toonFotoboek && photo.in_fotoboek && (
                <span className="w-6 h-6 rounded-full bg-primary/90 flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 text-white fill-white" />
                </span>
              )}
              {currentUserId && photo.user_id === currentUserId && onDeleteOwn && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteOwn(photo)
                  }}
                  aria-label="Mijn foto verwijderen"
                  className="w-7 h-7 rounded-full bg-foreground/50 hover:bg-destructive text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Compact: gekozen foto's iets gedimd met een rand eroverheen */}
          {compact && selectionMode && selectedIds.has(photo.id) && (
            <div className="absolute inset-0 rounded-md bg-primary/20 ring-4 ring-inset ring-primary pointer-events-none" />
          )}

          {/* Selection indicator */}
          {selectionMode && (
            <div className={cn(
              "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
              selectedIds.has(photo.id) 
                ? "bg-primary text-primary-foreground" 
                : "bg-card/80 text-foreground"
            )}>
              {selectedIds.has(photo.id) && <Check className="w-4 h-4" />}
            </div>
          )}

          {/* Selected badge */}
          {photo.is_selected && !selectionMode && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-accent text-accent-foreground text-xs font-medium rounded-full flex items-center gap-1">
              <Heart className="w-3 h-3 fill-current" />
              Geselecteerd
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && !selectionMode && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="secondary"
                className="w-8 h-8"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleSelection) {
                    handleAction(photo.id, async () => {
                      await onToggleSelection(photo.id, !photo.is_selected)
                    })
                  }
                }}
                disabled={loadingStates[photo.id]}
              >
                {loadingStates[photo.id] ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Heart className={cn("w-4 h-4", photo.is_selected && "fill-current text-accent")} />
                )}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="w-8 h-8"
                onClick={(e) => {
                  e.stopPropagation()
                  handleAction(photo.id, () => downloadFoto(photo))
                }}
                disabled={loadingStates[photo.id]}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="w-8 h-8"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onDelete) {
                    handleAction(photo.id, async () => {
                      await onDelete(photo.id)
                    })
                  }
                }}
                disabled={loadingStates[photo.id]}
              >
                {loadingStates[photo.id] ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
