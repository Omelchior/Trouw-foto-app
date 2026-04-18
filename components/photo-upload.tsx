"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Camera, Upload, X, Loader2, Check, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  getStoredToken,
  getStoredName,
  getUploadCounts,
  MAX_UPLOADS,
  MAX_FOTOBOEK,
  CHALLENGES,
  type UploadCounts,
} from "@/lib/guest"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 2400
const COMPRESSION_QUALITY = 0.85

async function compressImage(file: File): Promise<File> {
  if (file.size < 500 * 1024 || !file.type.startsWith("image/")) return file

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }))
          } else {
            resolve(file)
          }
        },
        "image/jpeg",
        COMPRESSION_QUALITY
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

async function uploadWithRetry<T>(op: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: Error | null = null
  for (let i = 1; i <= retries; i++) {
    try { return await op() } catch (e) {
      lastErr = e as Error
      if (i < retries) await new Promise(r => setTimeout(r, 1000 * i))
    }
  }
  throw lastErr
}

interface PhotoUploadProps {
  onUploadComplete?: () => void
  guestName?: string
  isPrivileged?: boolean
}

// Step 1: choose photos + challenge
// Step 2: pick which to put in fotoboek
// Step 3: uploading
// Step 4: done

type Step = "choose" | "fotoboek" | "uploading" | "done"

export function PhotoUpload({ onUploadComplete, guestName, isPrivileged }: PhotoUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [selectedChallenge, setSelectedChallenge] = useState<number | null>(null)
  const [fotoboekSelection, setFotoboekSelection] = useState<Set<number>>(new Set())
  const [step, setStep] = useState<Step>("choose")
  const [uploadProgress, setUploadProgress] = useState<number[]>([])
  const [counts, setCounts] = useState<UploadCounts>({ uploaded: 0, fotoboek: 0 })

  const token = getStoredToken()
  const name = guestName || getStoredName() || ""

  const uploadsLeft = isPrivileged ? 999 : Math.max(0, MAX_UPLOADS - counts.uploaded)
  const fotoboekLeft = Math.max(0, MAX_FOTOBOEK - counts.fotoboek)

  // Load counts on mount
  useEffect(() => {
    if (token) {
      getUploadCounts(token).then(setCounts)
    }
  }, [token])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const limit = Math.min(uploadsLeft, 10)
    const newFiles = acceptedFiles.slice(0, limit - files.length)

    const validFiles: File[] = []
    const oversized: string[] = []

    newFiles.forEach((f) => {
      if (f.size > MAX_FILE_SIZE) oversized.push(f.name)
      else validFiles.push(f)
    })

    if (oversized.length > 0) {
      toast.error(`${oversized.length} bestand(en) te groot (max 10MB)`)
    }
    if (validFiles.length === 0) return

    setFiles(prev => [...prev, ...validFiles])
    validFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
  }, [files.length, uploadsLeft])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic", ".heif"] },
    maxFiles: uploadsLeft,
    noClick: true,
    noKeyboard: true,
  })

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
    setFotoboekSelection(prev => {
      const next = new Set(prev)
      next.delete(index)
      // Re-map indices above removed
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
    if (!token) { toast.error("Sessie verlopen, herlaad de pagina"); return }
    if (files.length === 0) { toast.error("Selecteer minimaal 1 foto"); return }

    setStep("uploading")
    setUploadProgress(new Array(files.length).fill(0))
    const supabase = createClient()

    let success = 0
    let fail = 0

    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImage(files[i])
        const ext = compressed.type === "image/jpeg" ? "jpg" : files[i].name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

        await uploadWithRetry(async () => {
          const { error } = await supabase.storage.from("wedding-photos").upload(fileName, compressed)
          if (error) throw error
        })

        await uploadWithRetry(async () => {
          const { error } = await supabase.from("photos").insert({
            storage_path: fileName,
            uploaded_by: name,
            guest_token: token,
            challenge_id: selectedChallenge,
            in_fotoboek: fotoboekSelection.has(i),
          })
          if (error) throw error
        })

        success++
        setUploadProgress(prev => { const n = [...prev]; n[i] = 100; return n })
      } catch (e) {
        console.error("Upload error", e)
        fail++
      }
    }

    if (success > 0) {
      toast.success(`${success} foto${success > 1 ? "'s" : ""} geüpload! 🎉`)
    }
    if (fail > 0) {
      toast.error(`${fail} foto${fail > 1 ? "'s" : ""} mislukt`)
    }

    // Refresh counts
    if (token) {
      const newCounts = await getUploadCounts(token)
      setCounts(newCounts)
    }

    setStep("done")
    onUploadComplete?.()
  }

  const reset = () => {
    setFiles([])
    setPreviews([])
    setSelectedChallenge(null)
    setFotoboekSelection(new Set())
    setUploadProgress([])
    setStep("choose")
  }

  // ── Done screen ──────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold mb-1">Geüpload!</h2>
          <p className="text-muted-foreground text-sm">
            {!isPrivileged && `Je hebt nog ${uploadsLeft === 999 ? "∞" : Math.max(0, MAX_UPLOADS - counts.uploaded)} upload${Math.max(0, MAX_UPLOADS - counts.uploaded) === 1 ? "" : "s"} over.`}
          </p>
        </div>
        <Button onClick={reset} variant="outline" className="gap-2">
          <Camera className="w-4 h-4" />
          Nog meer foto's uploaden
        </Button>
      </div>
    )
  }

  // ── Uploading screen ─────────────────────────────────────────────
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

  // ── Fotoboek selection screen ────────────────────────────────────
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
            Uploaden ({fotoboekSelection.size} in fotoboek)
          </Button>
        </div>
      </div>
    )
  }

  // ── Main choose screen ───────────────────────────────────────────
  if (!isPrivileged && uploadsLeft === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-2">
          <Check className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-xl font-bold">Je hebt {MAX_UPLOADS} foto&apos;s geüpload</h2>
        <p className="text-muted-foreground text-sm">
          Super bedankt! Kijk bij het gastenboek om ook nog een berichtje achter te laten.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload limit indicator */}
      {!isPrivileged && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Foto&apos;s geüpload</span>
          <span className="font-medium">
            {counts.uploaded} / {MAX_UPLOADS}
            <span className="text-muted-foreground ml-1">({uploadsLeft} over)</span>
          </span>
        </div>
      )}

      {/* Challenges */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Kies een opdracht (optioneel)</p>
        <div className="grid grid-cols-2 gap-2">
          {CHALLENGES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChallenge(selectedChallenge === c.id ? null : c.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors",
                selectedChallenge === c.id
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border hover:border-primary/50"
              )}
            >
              <span className="text-lg">{c.emoji}</span>
              <span className="leading-tight">{c.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border"
        )}
      >
        <input {...getInputProps()} />

        {files.length === 0 ? (
          <div className="space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
              <Upload className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Sleep foto's hierheen</p>
              <p className="text-sm text-muted-foreground">of gebruik een van de opties</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={open} variant="outline" className="gap-2 bg-transparent">
                <Upload className="w-4 h-4" />
                Kies bestanden
              </Button>
              <Button
                onClick={() => {
                  const input = document.createElement("input")
                  input.type = "file"
                  input.accept = "image/*"
                  input.capture = "environment"
                  input.multiple = true
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files
                    if (f) onDrop(Array.from(f))
                  }
                  input.click()
                }}
                variant="outline"
                className="gap-2"
              >
                <Camera className="w-4 h-4" />
                Maak een foto
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
              {files.length < uploadsLeft && (
                <button
                  onClick={open}
                  className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {files.length} foto{files.length === 1 ? "" : "'s"} geselecteerd
            </p>
          </div>
        )}
      </div>

      <Button
        onClick={goToFotoboek}
        disabled={files.length === 0}
        className="w-full h-12 text-base gap-2"
      >
        <Heart className="w-4 h-4" />
        Verder naar fotoboek →
      </Button>
    </div>
  )
}
