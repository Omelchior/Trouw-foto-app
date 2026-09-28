"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  Shuffle,
  Minus,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useOpdrachten } from "@/components/opdrachten-provider"
import { isFotograafItem, isVideoItem, isVrijgegevenFotograaf } from "@/lib/media"
import { cn } from "@/lib/utils"

interface Photo {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  challenge_id?: number | null
  media_type?: string | null
  bron?: string | null
  zichtbaar_dag?: boolean
  zichtbaar_avond?: boolean
  url: string
}

/**
 * Waar de show uit put:
 *  - hoogtepunten: opdracht-foto's + foto's die via het beheer zijn geselecteerd
 *  - alle:         alle foto's die gasten hebben gedeeld
 *  - fotograaf:    de vrijgegeven foto's van de fotograaf (alleen daggasten en
 *                  beheer krijgen die uit de database, zie migratie 019)
 * Video's slaan we altijd over: die passen niet in de fade/ken-burns-loop en
 * zouden zonder geluid als zwart beeld voorbijkomen.
 */
type Bron = "hoogtepunten" | "alle" | "fotograaf"

const BRONNEN: { value: Bron; label: string }[] = [
  { value: "hoogtepunten", label: "Hoogtepunten" },
  { value: "alle", label: "Alle foto's" },
  { value: "fotograaf", label: "Fotograaf" },
]

function hoortInShow(p: Omit<Photo, "url">, bron: Bron): boolean {
  if (isVideoItem(p)) return false
  if (isFotograafItem(p)) return bron === "fotograaf" && isVrijgegevenFotograaf(p)
  if (bron === "fotograaf") return false
  return bron === "alle" || p.challenge_id != null || p.is_selected
}

/** Minimale veegafstand (px) om naar de vorige/volgende dia te gaan. */
const SWIPE_PX = 50

// Duur per dia (seconden) — instelbaar tussen deze grenzen
const MIN_SECONDS = 1
const MAX_SECONDS = 120
const DEFAULT_SECONDS = 6
const CONTROLS_HIDE_MS = 3500
const FADE_MS = 1200

const clampSeconds = (n: number) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(n)))

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
  const opdrachten = useOpdrachten()
  const [authState, setAuthState] = useState<"loading" | "ok" | "denied">("loading")
  // Alle foto's die deze gebruiker mag zien; de gekozen bron filtert daaruit.
  const [allePhotos, setAllePhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [bron, setBron] = useState<Bron>("hoogtepunten")

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [prevId, setPrevId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [slideSeconds, setSlideSeconds] = useState(DEFAULT_SECONDS)
  const [shuffle, setShuffle] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [kanFullscreen, setKanFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  // Kijkgeschiedenis: zodat "vorige" ook in willekeurige modus netjes terugloopt
  const historyRef = useRef<string[]>([])
  // Shuffle-wachtrij: elke foto komt één keer langs, daarna opnieuw geschud
  const shuffleQueueRef = useRef<string[]>([])

  const photos = useMemo(() => allePhotos.filter((p) => hoortInShow(p, bron)), [allePhotos, bron])
  const fotograafBeschikbaar = useMemo(
    () => allePhotos.some((p) => hoortInShow(p, "fotograaf")),
    [allePhotos],
  )
  const bronnen = BRONNEN.filter((b) => b.value !== "fotograaf" || fotograafBeschikbaar)

  // Beginbron uit de link (?bron=fotograaf vanuit de galerij).
  useEffect(() => {
    const gevraagd = new URLSearchParams(window.location.search).get("bron")
    if (gevraagd && BRONNEN.some((b) => b.value === gevraagd)) setBron(gevraagd as Bron)
    setKanFullscreen(!!document.fullscreenEnabled)
  }, [])

  // Geen fotograaf-foto's voor deze gebruiker (avondgast, of nog niets
  // vrijgegeven)? Dan terug naar de hoogtepunten.
  useEffect(() => {
    if (!isLoading && bron === "fotograaf" && !fotograafBeschikbaar) setBron("hoogtepunten")
  }, [isLoading, bron, fotograafBeschikbaar])

  // Andere bron (of willekeurig aan/uit): nieuwe geschudde volgorde, en bij een
  // andere bron opnieuw beginnen bij de eerste foto daarvan.
  useEffect(() => {
    shuffleQueueRef.current = []
  }, [shuffle, bron])

  useEffect(() => {
    historyRef.current = []
    setPrevId(null)
    setCurrentId(null)
  }, [bron])

  // Huidige foto verdwenen (verwijderd, of nog niets gekozen)? Pak de eerste.
  useEffect(() => {
    if (photos.length === 0) return
    if (!currentId || !photos.some((p) => p.id === currentId)) setCurrentId(photos[0].id)
  }, [photos, currentId])

  // --- Auth gate: iedere ingelogde gast (de middleware regelt of de app open is) ---
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/")
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
        .order("uploaded_at", { ascending: true })

      if (error) {
        console.error("Error fetching photos:", error)
      } else {
        setAllePhotos(
          (data || [])
            .filter((p) => !isVideoItem(p))
            .map((p) => ({ ...p, url: buildUrl(supabase, p.storage_path) })),
        )
      }
      setIsLoading(false)
    }

    load()

    // Nieuwe foto's stil aan de loop toevoegen; verwijderde foto's eruit
    // halen; (de)selecties en vrijgaves uit het beheer direct verwerken.
    const channel = supabase
      .channel("diavoorstelling-photos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "photos" }, (payload) => {
        const row = payload.new as Omit<Photo, "url">
        if (isVideoItem(row)) return
        setAllePhotos((prev) => {
          if (prev.some((p) => p.id === row.id)) return prev
          return [...prev, { ...row, url: buildUrl(supabase, row.storage_path) }]
        })
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "photos" }, (payload) => {
        const row = payload.new as Omit<Photo, "url">
        if (isVideoItem(row)) return
        const metUrl = { ...row, url: buildUrl(supabase, row.storage_path) }
        setAllePhotos((prev) =>
          prev.some((p) => p.id === row.id)
            ? prev.map((p) => (p.id === row.id ? metUrl : p))
            : [...prev, metUrl],
        )
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "photos" }, (payload) => {
        const removedId = (payload.old as { id: string }).id
        setAllePhotos((prev) => prev.filter((p) => p.id !== removedId))
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

        let nextId: string
        if (direction === -1 && historyRef.current.length > 0) {
          // Terug in de kijkgeschiedenis; sla ondertussen verwijderde foto's over
          let candidate = historyRef.current.pop() ?? null
          while (candidate && !photos.some((p) => p.id === candidate) && historyRef.current.length > 0) {
            candidate = historyRef.current.pop() ?? null
          }
          nextId = candidate && photos.some((p) => p.id === candidate) ? candidate : (curr ?? photos[0].id)
        } else if (shuffle) {
          // Shuffle-bag: eerst alle huidige foto's één keer (in willekeurige
          // volgorde), daarna wordt de lijst opnieuw geschud en begint hij weer.
          let queue = shuffleQueueRef.current.filter((id) => photos.some((p) => p.id === id))
          if (queue.length === 0) {
            queue = photos.map((p) => p.id)
            for (let i = queue.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1))
              ;[queue[i], queue[j]] = [queue[j], queue[i]]
            }
            // Voorkom dat de nieuwe ronde meteen met de huidige foto begint
            if (queue.length > 1 && queue[0] === curr) {
              const k = 1 + Math.floor(Math.random() * (queue.length - 1))
              ;[queue[0], queue[k]] = [queue[k], queue[0]]
            }
          }
          nextId = queue.shift() ?? curr ?? photos[0].id
          shuffleQueueRef.current = queue
        } else {
          const i = photos.findIndex((p) => p.id === curr)
          const baseIndex = i === -1 ? 0 : i
          nextId = photos[(baseIndex + direction + photos.length) % photos.length].id
        }

        if (nextId !== curr) {
          // Vooruit? Bewaar de huidige dia zodat "vorige" terugloopt
          if (direction === 1 && curr) {
            historyRef.current.push(curr)
            if (historyRef.current.length > 500) historyRef.current.shift()
          }
          setPrevId(curr)
          if (fadeTimer.current) clearTimeout(fadeTimer.current)
          fadeTimer.current = setTimeout(() => setPrevId(null), FADE_MS)
        }
        return nextId
      })
    },
    [photos, shuffle],
  )

  // --- Auto-advance ---
  // De laatste goTo in een ref, zodat de timer hieronder niet opnieuw hoeft te
  // starten telkens als de fotolijst verandert. Anders zou elke binnenkomende
  // upload de teller resetten en zou de show bij een uploadpiek "hangen".
  const goToRef = useRef(goTo)
  useEffect(() => {
    goToRef.current = goTo
  }, [goTo])

  const canPlay = photos.length >= 2
  useEffect(() => {
    if (!isPlaying || !canPlay) return
    const timer = setInterval(() => goToRef.current(1), slideSeconds * 1000)
    return () => clearInterval(timer)
  }, [isPlaying, slideSeconds, canPlay, bron])

  // --- Scherm aan houden zolang de show speelt (telefoons/tablets) ---
  useEffect(() => {
    if (!isPlaying || !("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | null = null
    let actief = true
    const aanvragen = async () => {
      try {
        const l = await navigator.wakeLock.request("screen")
        if (actief) lock = l
        else l.release().catch(() => {})
      } catch {
        // Niet toegestaan (bijv. batterijbesparing): dan maar zonder.
      }
    }
    // Het slot vervalt als het tabblad even op de achtergrond was.
    const opZichtbaar = () => {
      if (document.visibilityState === "visible") aanvragen()
    }
    aanvragen()
    document.addEventListener("visibilitychange", opZichtbaar)
    return () => {
      actief = false
      document.removeEventListener("visibilitychange", opZichtbaar)
      lock?.release().catch(() => {})
    }
  }, [isPlaying])

  // --- Bediening verbergen na inactiviteit ---
  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
  }, [])

  const hideControls = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setControlsVisible(false)
  }, [])

  useEffect(() => {
    showControls()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (fadeTimer.current) clearTimeout(fadeTimer.current)
    }
  }, [showControls])

  // --- Sluiten: terug naar waar je vandaan kwam (galerij of beheer) ---
  const sluiten = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    if (window.history.length > 1) router.back()
    else router.push("/selectie")
  }, [router])

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
      else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSlideSeconds((s) => clampSeconds(s + 1))
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSlideSeconds((s) => clampSeconds(s - 1))
      } else if (e.key === " ") {
        e.preventDefault()
        setIsPlaying((p) => !p)
      } else if (e.key === "s" || e.key === "S") setShuffle((s) => !s)
      else if (e.key === "f") toggleFullscreen()
      else if (e.key === "Escape" && !document.fullscreenElement) sluiten()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [authState, goTo, showControls, toggleFullscreen, sluiten])

  // --- Aanraken: vegen = vorige/volgende, tikken = bediening tonen/verbergen ---
  const vegen = useRef(false)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    vegen.current = false
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      vegen.current = true
      goTo(dx < 0 ? 1 : -1)
    }
  }
  const onClick = (e: React.MouseEvent) => {
    // Na een veeg geen tik-actie; knoppen bedienen zichzelf.
    if (vegen.current) {
      vegen.current = false
      return
    }
    if ((e.target as HTMLElement).closest("button, input, a")) {
      showControls()
      return
    }
    if (controlsVisible) hideControls()
    else showControls()
  }

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
  const opdrachtTekst =
    current?.challenge_id != null
      ? (opdrachten.find((c) => c.id === current.challenge_id)?.text ?? `Opdracht ${current.challenge_id}`)
      : null

  const leegTekst =
    bron === "hoogtepunten"
      ? "Opdracht-foto's en via het beheer geselecteerde foto's verschijnen hier automatisch."
      : bron === "alle"
        ? "Foto's die gasten in de galerij delen verschijnen hier automatisch."
        : "Er zijn nog geen foto's van de fotograaf vrijgegeven."

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden cursor-default select-none touch-manipulation"
      onPointerMove={(e) => e.pointerType === "mouse" && showControls()}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-4 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <Images className="w-10 h-10" />
          </div>
          <p className="text-xl">Nog geen foto's om te tonen</p>
          <p className="text-sm text-white/50">{leegTekst}</p>
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

      {/* Bovenbalk: teller + live-indicator, bronkeuze, sluiten */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 flex flex-wrap items-center justify-between gap-y-2 px-3 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300",
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

        {/* Welke foto's: op de telefoon op een eigen regel onder de teller */}
        <div className="order-last w-full flex justify-center sm:order-none sm:w-auto">
          <div
            className="inline-flex rounded-full bg-white/10 backdrop-blur p-1"
            role="radiogroup"
            aria-label="Welke foto's"
          >
            {bronnen.map((b) => (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={bron === b.value}
                onClick={() => setBron(b.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  bron === b.value ? "bg-white text-black" : "text-white/80 hover:text-white",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full"
          onClick={sluiten}
          title="Sluiten (Esc)"
          aria-label="Sluiten"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Onderkant: naam + opdracht boven de bediening */}
      <div className="absolute bottom-0 inset-x-0 flex flex-col items-center gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        {/* Naam + opdracht alleen bij opdracht-foto's; vrije foto's blijven anoniem.
            De opdracht mag over meerdere regels lopen, zodat hij ook op een
            telefoon volledig te lezen is. */}
        {current && opdrachtTekst && (
          <div className="flex flex-col items-center gap-2 max-w-full sm:max-w-2xl">
            <span className="inline-flex items-center gap-2 max-w-full text-white/95 text-base sm:text-lg font-serif bg-black/40 backdrop-blur px-4 py-1.5 sm:py-2 rounded-full">
              <Heart className="w-4 h-4 text-primary fill-current shrink-0" />
              <span className="truncate">{current.uploaded_by}</span>
            </span>
            <div className="flex items-start gap-2 text-left text-white/90 text-sm sm:text-base leading-snug bg-black/40 backdrop-blur px-3 py-2 sm:px-4 rounded-2xl">
              <span className="flex items-center justify-center w-5 h-5 mt-px rounded-full bg-primary text-white text-[10px] font-bold shrink-0">
                {current.challenge_id}
              </span>
              <span className="line-clamp-4">{opdrachtTekst}</span>
            </div>
          </div>
        )}

        {/* Bediening */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-1 sm:gap-3 transition-opacity duration-300",
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 rounded-full w-10 h-10 sm:w-12 sm:h-12"
            onClick={() => goTo(-1)}
            title="Vorige (←)"
            aria-label="Vorige"
          >
            <ChevronLeft className="w-7 h-7" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 rounded-full w-12 h-12 sm:w-14 sm:h-14"
            onClick={() => setIsPlaying((p) => !p)}
            title={isPlaying ? "Pauze (spatie)" : "Afspelen (spatie)"}
            aria-label={isPlaying ? "Pauze" : "Afspelen"}
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 rounded-full w-10 h-10 sm:w-12 sm:h-12"
            onClick={() => goTo(1)}
            title="Volgende (→)"
            aria-label="Volgende"
          >
            <ChevronRight className="w-7 h-7" />
          </Button>

          {/* Willekeurige volgorde aan/uit */}
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "rounded-full w-10 h-10 sm:w-12 sm:h-12",
              shuffle ? "text-primary bg-white/20 hover:bg-white/30" : "text-white hover:bg-white/20",
            )}
            onClick={() => setShuffle((s) => !s)}
            title={shuffle ? "Willekeurig aan (s)" : "Willekeurig uit (s)"}
            aria-label="Willekeurige volgorde"
            aria-pressed={shuffle}
          >
            <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>

          {/* Duur per dia zelf instellen (seconden) */}
          <div
            className="flex items-center gap-0.5 sm:gap-1 sm:ml-2 text-white bg-white/10 rounded-full pl-1.5 sm:pl-3 pr-1.5 py-1"
            title="Seconden per dia (↑/↓)"
          >
            <Gauge className="hidden sm:block w-5 h-5 mr-1 shrink-0" />
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              onClick={() => setSlideSeconds((s) => clampSeconds(s - 1))}
              aria-label="Korter per dia"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex items-baseline">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_SECONDS}
                max={MAX_SECONDS}
                value={slideSeconds}
                aria-label="Seconden per dia"
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!Number.isNaN(v)) setSlideSeconds(clampSeconds(v))
                }}
                className="w-8 bg-transparent text-center text-base font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-sm text-white/70">s</span>
            </div>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              onClick={() => setSlideSeconds((s) => clampSeconds(s + 1))}
              aria-label="Langer per dia"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Niet elke telefoon kan volledig scherm (iPhone-Safari niet) */}
          {kanFullscreen && (
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/20 rounded-full w-10 h-10 sm:w-12 sm:h-12 sm:ml-1"
              onClick={toggleFullscreen}
              title="Volledig scherm (f)"
              aria-label="Volledig scherm"
            >
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
