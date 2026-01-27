"use client"

import { useState } from "react"
import { Heart, Check, X, Download, Loader2 } from "lucide-react"
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

interface PhotoGridProps {
  photos: Photo[]
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onPhotoClick?: (photo: Photo) => void
  isAdmin?: boolean
  onDelete?: (id: string) => void
  onToggleSelection?: (id: string, selected: boolean) => void
}

export function PhotoGrid({
  photos,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  onPhotoClick,
  isAdmin = false,
  onDelete,
  onToggleSelection
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
        <p className="text-lg text-muted-foreground">Nog geen foto's geupload</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className={cn(
            "relative aspect-square group cursor-pointer",
            selectionMode && selectedIds.has(photo.id) && "ring-4 ring-primary rounded-lg"
          )}
          onClick={() => {
            if (selectionMode && onToggleSelect) {
              onToggleSelect(photo.id)
            } else if (onPhotoClick) {
              onPhotoClick(photo)
            }
          }}
        >
          <img
            src={photo.url || "/placeholder.svg"}
            alt={`Foto van ${photo.uploaded_by}`}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
          />
          
          {/* Overlay with uploader name */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent p-3 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-sm text-primary-foreground font-medium truncate">
              {photo.uploaded_by}
            </p>
          </div>

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
                  window.open(photo.url, '_blank')
                }}
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
