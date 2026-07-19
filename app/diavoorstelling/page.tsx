"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize,
  Minimize,
  Gauge,
  Images,
  Heart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getChallenge } from "@/lib/guest"
import { cn } from "@/lib/utils"

interface Photo {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  challenge_id?: number | null
  url: string
}

/** De show draait op opdracht-foto's + foto's die via het beheer zijn geselecteerd. */
function hoortInShow(p: Pick<Photo, "challenge_id" | "is_selected">): boolean {
  return p.challenge_id != null || p.is_selected
}

// Beschikbare tempo's (seconden per foto)
const SPEEDS = [4, 6, 8, 10, 15]
const CONTROLS_HIDE_MS = 3500
const FADE_MS = 1200

function buildUrl(supabase: ReturnType<typeof createClient>, storagePath: string): string {
  return supabase.storage.from("wedding-photos").getPublicUrl(storagePath).data.publicUrl
}

/**
 * Eén dia. Standaard fade't hij bij het mounten zachtjes in; met `fadeUit`
 * start hij zichtbaar en fade't hij naar onzichtbaar (de vertrekkende dia).
 */
function Slide({ photo, fadeUit = false }: { photo: Photo; fadeUit?: boolean }) {
  const [zichtbaar, setZichtbaar] = useState(fadeUit)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setZichtbaar(!fadeUit))
    return () => cancelAnimationFrame(raf)
  }, [fadeUit])

  return (
    <img
      src={photo.url}
      alt={fadeUit ? "" : `Foto van ${photo.uploaded_by}`}
      className="absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity ease-in-out"
      style={{
        opacity: zichtbaar ? 1 : 0,
        transitionDuration: `${FADE_MS}ms`,
        animation: !fadeUit && zichtbaar ? "diaKenburns 18s ease-out forwards" : undefined,
      }}
    />
  )
}

export default function DiavoorstellingPage() {
  const router = useRouter()
  const [authState, setAuthState] = useState<"loading" | "ok" | "denied">("loading")
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [prevId, setPrevId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speedIdx, setSpeedIdx] = useState(1) // default 6s
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Auth gate (admin of ceremoniemeester = ingelogde user) ---
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/admin/login")
        setAuthState("denied")
      } else {
        setAuthState("ok")
      }
    })
  }, [router])

  // --- Foto's laden + realtime ---
  useEffect(() => {
    if (authState !== "ok") return
    const supabase = createClient()

    const load = async () => {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .or("challenge_id.not.is.null,is_selected.eq.true")
        .order("uploaded_at", { ascending: true })

      if (error) {
        console.error("Error fetching photos:", error)
      } else {
        const withUrls = (data || []).map((p) => ({ ...p, url: buildUrl(supabase, p.storage_path) }))
        setPhotos(withUrls)
        setCurrentId((prev) => prev ?? withUrls[0]?.id ?? null)
      }
      setIsLoading(false)
    }

    load()

    // Nieuwe opdracht-foto's stil aan de loop toevoegen; verwijderde foto's
    // eruit halen; (de)selecties uit het beheer direct verwerken.
    const channel = supabase
      .channel("diavoorstelling-photos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "photos" }, (payload) => {
        const row = payload.new as Omit<Photo, "url">
        if (!hoortInShow(row)) return
        setPhotos((prev) => {
          if (prev.some((p) => p.id === row.id)) return prev
          return [...prev, { ...row, url: buildUrl(supabase, row.storage_path) }]
        })
        setCurrentId((prev) => prev ?? row.id)
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "photos" }, (payload) => {
        const row = payload.new as Omit<Photo, "url">
        setPhotos((prev) => {
          const zitErin = prev.some((p) => p.id === row.id)
          if (hoortInShow(row)) {
            const metUrl = { ...row, url: buildUrl(supabase, row.storage_path) }
            return zitErin
              ? prev.map((p) => (p.id === row.id ? metUrl : p))
              : [...prev, metUrl]
          }
          return zitErin ? prev.filter((p) => p.id !== row.id) : prev
        })
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "photos" }, (payload) => {
        const removedId = (payload.old as { id: string }).id
        setPhotos((prev) => prev.filter((p) => p.id !== removedId))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [authState])

  // --- Navigatie tussen dia's ---
  const goTo = useCallback(
    (direction: 1 | -1) => {
      setCurrentId((curr) => {
        if (photos.length === 0) return curr
        const i = photos.findIndex((p) => p.id === curr)
        const baseIndex = i === -1 ? 0 : i
        const nextIndex = (baseIndex + direction + photos.length) % photos.length
        const nextId = photos[nextIndex].id
        if (nextId !== curr) {
          setPrevId(curr)
          if (fadeTimer.current) clearTimeout(fadeTimer.current)
          fadeTimer.current = setTimeout(() => setPrevId(null), FADE_MS)
        }
        return nextId
      })
    },
    [photos],
  )

  // --- Auto-advance ---
  useEffect(() => {
    if (!isPlaying || photos.length < 2) return
    const ms = SPEEDS[speedIdx] * 1000
    const timer = setInterval(() => goTo(1), ms)
    return () => clearInterval(timer)
  }, [isPlaying, speedIdx, photos.length, currentId, goTo])

  // --- Bediening verbergen na inactiviteit ---
  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
  }, [])

  useEffect(() => {
    showControls()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (fadeTimer.current) clearTimeout(fadeTimer.current)
    }
  }, [showControls])

  // --- Fullscreen ---
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  // --- Toetsenbordbediening ---
  useEffect(() => {
    if (authState !== "ok") return
    const onKey = (e: KeyboardEvent) => {
      showControls()
      if (e.key === "ArrowRight") goTo(1)
      else if (e.key === "ArrowLeft") goTo(-1)
      else if (e.key === " ") {
        e.preventDefault()
        setIsPlaying((p) => !p)
      } else if (e.key === "f") toggleFullscreen()
      else if (e.key === "Escape" && !document.fullscreenElement) router.push("/admin")
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [authState, goTo, showControls, toggleFullscreen, router])

  if (authState !== "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white/70" />
      </div>
    )
  }

  const current = photos.find((p) => p.id === currentId) ?? null
  const prev = prevId ? photos.find((p) => p.id === prevId) ?? null : null
  const currentIndex = current ? photos.findIndex((p) => p.id === current.id) : -1

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden cursor-default"
      onMouseMove={showControls}
      onClick={showControls}
    >
      <style>{`
        @keyframes diaKenburns {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
      `}</style>

      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-white/70" />
        </div>
      ) : photos.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-4">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <Images className="w-10 h-10" />
          </div>
          <p className="text-xl">Nog geen foto's om te tonen</p>
          <p className="text-sm text-white/50">
            Opdracht-foto's en via het beheer geselecteerde foto's verschijnen hier automatisch.
          </p>
        </div>
      ) : (
        <>
          {/* Wazige achtergrond ter opvulling van de zwarte balken */}
          {current && (
            <div
              key={`bg-${current.id}`}
              className="absolute inset-0 bg-center bg-cover scale-110 blur-2xl opacity-30 transition-opacity"
              style={{ backgroundImage: `url(${current.url})`, transitionDuration: `${FADE_MS}ms` }}
            />
          )}

          {/* Vorige dia fade't uit terwijl de nieuwe infade't */}
          {prev && <Slide key={`prev-${prev.id}`} photo={prev} fadeUit />}

          {/* Huidige dia fade't eroverheen in */}
          {current && <Slide key={current.id} photo={current} />}
        </>
      )}

      {/* Bovenbalk: teller + live-indicator */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <div className="flex items-center gap-2 text-white/90">
          <span className="flex items-center gap-2 text-sm font-medium bg-white/10 backdrop-blur px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live
          </span>
          {photos.length > 0 && (
            <span className="text-sm text-white/70 tabular-nums">
              {currentIndex + 1} / {photos.length}
            </span>
          )}
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full"
          onClick={() => router.push("/admin")}
          title="Sluiten (Esc)"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Wie de foto maakte en voor welke opdracht — altijd in beeld */}
      {current && (
        <div className="absolute bottom-24 inset-x-0 px-4 text-center space-y-2">
          <div>
            <span className="inline-flex items-center gap-2 text-white/90 text-lg font-serif bg-black/30 backdrop-blur px-4 py-2 rounded-full">
              <Heart className="w-4 h-4 text-primary fill-current" />
              {current.uploaded_by}
            </span>
          </div>
          {current.challenge_id != null && (
            <div>
              <span className="inline-flex items-center gap-2 max-w-[90vw] text-white/80 text-sm bg-black/30 backdrop-blur px-4 py-1.5 rounded-full">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold shrink-0">
                  {current.challenge_id}
                </span>
                <span className="truncate">
                  {getChallenge(current.challenge_id)?.text ?? `Opdracht ${current.challenge_id}`}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Onderbalk: bediening */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 flex items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full w-12 h-12"
          onClick={() => goTo(-1)}
          title="Vorige (←)"
        >
          <ChevronLeft className="w-7 h-7" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full w-14 h-14"
          onClick={() => setIsPlaying((p) => !p)}
          title={isPlaying ? "Pauze (spatie)" : "Afspelen (spatie)"}
        >
          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full w-12 h-12"
          onClick={() => goTo(1)}
          title="Volgende (→)"
        >
          <ChevronRight className="w-7 h-7" />
        </Button>

        <Button
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full gap-2 ml-2"
          onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}
          title="Snelheid aanpassen"
        >
          <Gauge className="w-5 h-5" />
          {SPEEDS[speedIdx]}s
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full w-12 h-12"
          onClick={toggleFullscreen}
          title="Volledig scherm (f)"
        >
          {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
        </Button>
      </div>
    </div>
  )
}
