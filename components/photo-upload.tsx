"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Camera, Upload, X, Loader2, Check, Heart, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  getUploadCounts,
  markChallengeCompleted,
  getChallenge,
  getCurrentProfile,
  volgendeOpdracht,
  MAX_FOTOBOEK,
  type Challenge,
  type UploadCounts,
} from "@/lib/guest"
import { uploadFoto, MAX_FILE_SIZE } from "@/lib/foto-upload"

interface PhotoUploadProps {
  onUploadComplete?: () => void
  guestName: string
  userId: string
  isPrivileged?: boolean
  /** Gekoppelde opdracht die klaarstaat als er geen ?challenge= in de URL zit. */
  standaardOpdracht?: number | null
  /** Snelle modus (galerij): direct uploaden, zonder fotoboek-stap. */
  directUploaden?: boolean
}

type Step = "choose" | "fotoboek" | "uploading" | "done"

export function PhotoUpload({
  onUploadComplete,
  guestName,
  userId,
  standaardOpdracht,
  directUploaden = false,
}: PhotoUploadProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // De opdracht die zojuist met een upload is voltooid; bevroren voor het
  // done-scherm zodat die blijft staan terwijl de standaard-opdracht vervalt.
  const [voltooideOpdracht, setVoltooideOpdracht] = useState<Challenge | null>(null)
  const [standaardAfgerond, setStandaardAfgerond] = useState(false)

  const challengeIdParam = searchParams.get("challenge")
  const paramId = challengeIdParam ? parseInt(challengeIdParam, 10) : null
  const challengeId =
    paramId ??
    (standaardOpdracht != null && !standaardAfgerond ? standaardOpdracht : null)
  const challenge = challengeId ? getChallenge(challengeId) : null

  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [fotoboekSelection, setFotoboekSelection] = useState<Set<number>>(new Set())
  const [step, setStep] = useState<Step>("choose")
  const [uploadProgress, setUploadProgress] = useState<number[]>([])
  const [counts, setCounts] = useState<UploadCounts>({ uploaded: 0, fotoboek: 0 })

  const fotoboekLeft = Math.max(0, MAX_FOTOBOEK - counts.fotoboek)

  // Per opdracht mag maar één foto worden geüpload.
  const enkeleFoto = challengeId != null

  useEffect(() => {
    getUploadCounts(userId).then(setCounts)
  }, [userId])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles: File[] = []
    const oversized: string[] = []

    acceptedFiles.forEach((f) => {
      if (f.size > MAX_FILE_SIZE) oversized.push(f.name)
      else validFiles.push(f)
    })

    if (oversized.length > 0) {
      toast.error(`${oversized.length} bestand(en) te groot (max 10MB per foto)`)
    }
    if (validFiles.length === 0) return

    if (enkeleFoto) {
      // Nieuwe keuze vervangt de vorige; er past er maar één bij een opdracht.
      if (validFiles.length > 1) {
        toast.error("Voor een opdracht kun je één foto kiezen")
      }
      const file = validFiles[0]
      setFiles([file])
      setFotoboekSelection(new Set())
      const reader = new FileReader()
      reader.onload = () => setPreviews([reader.result as string])
      reader.readAsDataURL(file)
      return
    }

    setFiles(prev => [...prev, ...validFiles])
    validFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
  }, [enkeleFoto])

  // Foto's kiezen via een gewone file-picker (de app wordt vooral op
  // telefoons gebruikt, dus geen sleepvlak).
  const kiesFotos = useCallback((viaCamera: boolean) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.multiple = !enkeleFoto
    if (viaCamera) input.capture = "environment"
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files
      if (f) onDrop(Array.from(f))
    }
    input.click()
  }, [onDrop, enkeleFoto])

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
    setFotoboekSelection(prev => {
      const next = new Set(prev)
      next.delete(index)
      const remapped = new Set<number>()
      next.forEach(i => { if (i < index) remapped.add(i); else if (i > index) remapped.add(i - 1) })
      return remapped
    })
  }

  const toggleFotoboek = (index: number) => {
    setFotoboekSelection(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else if (next.size < fotoboekLeft) {
        next.add(index)
      } else {
        toast.error(`Je kunt nog maar ${fotoboekLeft} foto${fotoboekLeft === 1 ? "" : "'s"} toevoegen aan het fotoboek`)
      }
      return next
    })
  }

  const goToFotoboek = () => {
    if (files.length === 0) {
      toast.error("Selecteer minimaal 1 foto")
      return
    }
    setStep("fotoboek")
  }

  const handleUpload = async () => {
    if (files.length === 0) { toast.error("Selecteer minimaal 1 foto"); return }

    setStep("uploading")
    setUploadProgress(new Array(files.length).fill(0))

    let success = 0
    let fail = 0

    for (let i = 0; i < files.length; i++) {
      try {
        await uploadFoto({
          file: files[i],
          guestName,
          userId,
          challengeId,
          inFotoboek: fotoboekSelection.has(i),
        })
        success++
        setUploadProgress(prev => { const n = [...prev]; n[i] = 100; return n })
      } catch (e) {
        console.error("Upload error", e)
        fail++
      }
    }

    if (success > 0 && challengeId) {
      try {
        await markChallengeCompleted(challengeId)
      } catch (e) {
        console.error("Mark challenge error", e)
      }
      setVoltooideOpdracht(challenge ?? null)
      if (challengeId === standaardOpdracht) setStandaardAfgerond(true)
    }

    if (success > 0) {
      toast.success(`${success} foto${success > 1 ? "'s" : ""} geüpload! 🎉`)
    }
    if (fail > 0) {
      toast.error(`${fail} foto${fail > 1 ? "'s" : ""} mislukt`)
    }

    const newCounts = await getUploadCounts(userId)
    setCounts(newCounts)

    setStep("done")
    onUploadComplete?.()
  }

  const reset = () => {
    setFiles([])
    setPreviews([])
    setFotoboekSelection(new Set())
    setUploadProgress([])
    setVoltooideOpdracht(null)
    setStep("choose")
  }

  const backToBingo = () => {
    router.push("/bingo")
  }

  // Kies een willekeurige opdracht die de gast nog niet heeft gedaan en
  // start de upload-flow daarvoor opnieuw.
  const [zoektOpdracht, setZoektOpdracht] = useState(false)
  const nogEenOpdracht = async () => {
    setZoektOpdracht(true)
    try {
      const profile = await getCurrentProfile()
      const volgende = volgendeOpdracht(
        profile?.completed_challenges ?? [],
        voltooideOpdracht?.id ?? challengeId
      )
      if (!volgende) {
        toast.success("Wauw, je hebt álle opdrachten al gedaan! 🎉")
        return
      }
      reset()
      router.push(`/?challenge=${volgende.id}`)
    } finally {
      setZoektOpdracht(false)
    }
  }

  if (step === "done") {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold mb-1">Geüpload!</h2>
          {voltooideOpdracht && (
            <p className="text-sm text-primary font-medium">
              Opdracht #{voltooideOpdracht.id} afgevinkt ✓
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {voltooideOpdracht && (
            <Button onClick={nogEenOpdracht} disabled={zoektOpdracht} className="gap-2">
              {zoektOpdracht ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Target className="w-4 h-4" />
              )}
              Ik wil nog een opdracht!
            </Button>
          )}
          <Button
            onClick={reset}
            variant={directUploaden ? "default" : "outline"}
            className="gap-2"
          >
            <Camera className="w-4 h-4" />
            Nog meer uploaden
          </Button>
          {!directUploaden && (
            <Button
              onClick={backToBingo}
              variant={voltooideOpdracht ? "outline" : "default"}
              className="gap-2"
            >
              <Target className="w-4 h-4" />
              Terug naar de opdrachten
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (step === "uploading") {
    const done = uploadProgress.filter(p => p === 100).length
    return (
      <div className="text-center space-y-4 py-8">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="font-medium">Uploaden... {done}/{files.length}</p>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${(done / files.length) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  if (step === "fotoboek") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-serif text-xl font-bold mb-1">Kies voor het fotoboek</h2>
          <p className="text-sm text-muted-foreground">
            Selecteer maximaal {fotoboekLeft} foto{fotoboekLeft === 1 ? "" : "'s"} die in ons fotoboek komen.
            <br />
            <span className="text-xs">(Je kunt dit overslaan)</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {previews.map((preview, index) => {
            const selected = fotoboekSelection.has(index)
            return (
              <button
                key={index}
                onClick={() => toggleFotoboek(index)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden transition-all",
                  selected && "ring-4 ring-primary"
                )}
              >
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <div className={cn(
                  "absolute inset-0 flex items-center justify-center transition-colors",
                  selected ? "bg-primary/30" : "bg-transparent hover:bg-black/10"
                )}>
                  {selected && (
                    <div className="bg-primary rounded-full p-1.5">
                      <Heart className="w-5 h-5 text-white fill-white" />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-1 right-1 text-xs bg-black/50 text-white rounded px-1">
                  {index + 1}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("choose")} className="flex-1">
            Terug
          </Button>
          <Button onClick={handleUpload} className="flex-1 gap-2">
            <Upload className="w-4 h-4" />
            Uploaden
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Opdracht en upload vormen samen één kaart */}
      <div className="border border-border rounded-xl overflow-hidden">
        {challenge && (
          <div className="bg-primary/10 border-b border-primary/20 p-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                {challenge.id}
              </div>
              <div className="flex-1">
                <p className="text-xs text-primary font-medium uppercase tracking-wide mb-0.5">
                  {paramId ? "Foto-opdracht" : "Jouw foto-opdracht"}
                </p>
                <p className="text-sm text-foreground">{challenge.text}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 text-center">
        {files.length === 0 ? (
          <div className="space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
              <Camera className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium">
              {challenge ? "Maak of kies één foto voor deze opdracht" : "Deel je foto's van vandaag"}
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => kiesFotos(true)}
                className="w-full h-12 text-base gap-2"
              >
                <Camera className="w-5 h-5" />
                Maak een foto
              </Button>
              <Button
                onClick={() => kiesFotos(false)}
                variant="outline"
                className="w-full h-12 text-base gap-2"
              >
                <Upload className="w-5 h-5" />
                Kies uit je galerij
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square group">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!enkeleFoto && (
                <button
                  onClick={() => kiesFotos(false)}
                  className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {files.length} foto{files.length === 1 ? "" : "'s"} geselecteerd
            </p>
            {enkeleFoto && (
              <Button
                onClick={() => kiesFotos(false)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Andere foto kiezen
              </Button>
            )}
          </div>
        )}
        </div>
      </div>

      {directUploaden ? (
        <Button
          onClick={handleUpload}
          disabled={files.length === 0}
          className="w-full h-12 text-base gap-2"
        >
          <Upload className="w-4 h-4" />
          Uploaden
        </Button>
      ) : (
        <Button
          onClick={goToFotoboek}
          disabled={files.length === 0}
          className="w-full h-12 text-base gap-2"
        >
          <Heart className="w-4 h-4" />
          Verder naar fotoboek →
        </Button>
      )}
    </div>
  )
}
