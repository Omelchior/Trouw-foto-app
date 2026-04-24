"use client"

import { useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHALLENGES } from "@/lib/guest"
import { PhotoLightbox } from "@/components/photo-lightbox"

export interface BingoPhoto {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  url?: string
}

interface BingoBoardProps {
  completed: number[]
  photosByChallenge?: Record<number, BingoPhoto>
}

export function BingoBoard({ completed, photosByChallenge = {} }: BingoBoardProps) {
  const completedSet = new Set(completed)
  const [lightbox, setLightbox] = useState<BingoPhoto | null>(null)

  return (
    <>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {CHALLENGES.map((c) => {
          const done = completedSet.has(c.id)
          const photo = photosByChallenge[c.id]

          // Voltooide cel met foto: thumbnail die de lightbox opent
          if (done && photo) {
            return (
              <button
                key={c.id}
                onClick={() => setLightbox(photo)}
                aria-label={`Foto voor opdracht ${c.id}: ${c.text}`}
                className="relative aspect-square rounded-lg overflow-hidden border-2 border-primary group"
              >
                <img
                  src={photo.url || "/placeholder.svg"}
                  alt={c.text}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-foreground/30" />
                <div className="absolute top-1 left-1 text-[10px] sm:text-xs font-bold text-white bg-primary/90 rounded px-1.5 py-0.5">
                  #{c.id}
                </div>
                <div className="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" strokeWidth={3} />
                </div>
              </button>
            )
          }

          // Voltooide cel zonder foto (data-edge case): gewoon check, geen link
          if (done) {
            return (
              <div
                key={c.id}
                aria-label={`Opdracht ${c.id} voltooid`}
                className="relative aspect-square rounded-lg border-2 border-primary bg-primary/10 p-1.5 sm:p-2 text-[10px] sm:text-xs leading-tight flex flex-col items-stretch justify-between"
              >
                <div className="flex items-start justify-between">
                  <span className="font-bold text-primary/80">#{c.id}</span>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                  </div>
                </div>
                <p className="line-clamp-4 sm:line-clamp-5 text-foreground/80">{c.text}</p>
              </div>
            )
          }

          // Niet-voltooide cel: link naar upload-flow met challenge
          return (
            <Link
              key={c.id}
              href={`/?challenge=${c.id}`}
              aria-label={`Opdracht ${c.id}: ${c.text}`}
              className="relative aspect-square rounded-lg border-2 border-border bg-card p-1.5 sm:p-2 text-[10px] sm:text-xs leading-tight flex flex-col items-stretch justify-between transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-start justify-between">
                <span className="font-bold text-primary/80">#{c.id}</span>
              </div>
              <p className={cn("line-clamp-4 sm:line-clamp-5 text-foreground")}>{c.text}</p>
            </Link>
          )
        })}
      </div>

      <PhotoLightbox
        photo={lightbox as never}
        photos={lightbox ? [lightbox as never] : []}
        onClose={() => setLightbox(null)}
        onNavigate={() => {}}
      />
    </>
  )
}
