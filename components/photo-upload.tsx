"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Camera, Upload, X, Loader2, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_DIMENSION = 2400 // Max width/height after compression
const COMPRESSION_QUALITY = 0.85

// Compress image client-side for faster uploads
async function compressImage(file: File): Promise<File> {
  // Skip compression for small files or non-image types
  if (file.size < 500 * 1024 || !file.type.startsWith("image/")) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    
    img.onload = () => {
      let { width, height } = img
      
      // Calculate new dimensions
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(file) // Fallback to original
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          } else {
            resolve(file) // Use original if compression didn't help
          }
        },
        "image/jpeg",
        COMPRESSION_QUALITY
      )
    }

    img.onerror = () => resolve(file) // Fallback to original on error
    img.src = URL.createObjectURL(file)
  })
}

// Retry wrapper for upload operations
async function uploadWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs * attempt))
      }
    }
  }
  
  throw lastError
}

interface PhotoUploadProps {
  onUploadComplete?: () => void
}

export function PhotoUpload({ onUploadComplete }: PhotoUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploaderName, setUploaderName] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.slice(0, 10 - files.length)
    
    // Validate file sizes
    const validFiles: File[] = []
    const oversizedFiles: string[] = []
    
    newFiles.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file.name)
      } else {
        validFiles.push(file)
      }
    })
    
    if (oversizedFiles.length > 0) {
      toast.error(`${oversizedFiles.length} bestand(en) te groot (max 10MB)`, {
        description: oversizedFiles.slice(0, 3).join(", ") + (oversizedFiles.length > 3 ? "..." : "")
      })
    }
    
    if (validFiles.length === 0) return
    
    setFiles((prev) => [...prev, ...validFiles])
    
    validFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setPreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }, [files.length])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic", ".heif"]
    },
    maxFiles: 10,
    noClick: true,
    noKeyboard: true
  })

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (!uploaderName.trim()) {
      toast.error("Vul je naam in")
      return
    }
    if (files.length === 0) {
      toast.error("Selecteer minimaal 1 foto")
      return
    }

    setIsUploading(true)
    setUploadProgress(new Array(files.length).fill(0))
    const supabase = createClient()

    let successCount = 0
    let failCount = 0

    try {
      for (let i = 0; i < files.length; i++) {
        try {
          // Compress image before upload
          const compressedFile = await compressImage(files[i])
          const fileExt = compressedFile.type === "image/jpeg" ? "jpg" : files[i].name.split(".").pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

          // Upload to storage with retry
          await uploadWithRetry(async () => {
            const { error: uploadError } = await supabase.storage
              .from("wedding-photos")
              .upload(fileName, compressedFile)

            if (uploadError) throw uploadError
          })

          // Save to database with retry
          await uploadWithRetry(async () => {
            const { error: dbError } = await supabase
              .from("photos")
              .insert({
                storage_path: fileName,
                uploaded_by: uploaderName.trim()
              })

            if (dbError) throw dbError
          })

          successCount++
          setUploadProgress((prev) => {
            const newProgress = [...prev]
            newProgress[i] = 100
            return newProgress
          })
        } catch (error) {
          console.error(`Upload error for file ${i}:`, error)
          failCount++
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} foto${successCount > 1 ? "'s" : ""} geupload!`)
      }
      if (failCount > 0) {
        toast.error(`${failCount} foto${failCount > 1 ? "'s" : ""} mislukt`, {
          description: "Probeer deze opnieuw te uploaden"
        })
      }
      
      setFiles([])
      setPreviews([])
      setUploaderName("")
      onUploadComplete?.()
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Er ging iets mis bij het uploaden")
    } finally {
      setIsUploading(false)
      setUploadProgress([])
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-base">Je naam</Label>
        <Input
          id="name"
          placeholder="Bijv. Jan & Marieke"
          value={uploaderName}
          onChange={(e) => setUploaderName(e.target.value)}
          className="text-base h-12"
        />
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border",
          files.length > 0 ? "pb-4" : ""
        )}
      >
        <input {...getInputProps()} />
        
        {files.length === 0 ? (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">Sleep foto's hierheen</p>
              <p className="text-muted-foreground">of gebruik een van onderstaande opties</p>
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
                    const files = (e.target as HTMLInputElement).files
                    if (files) onDrop(Array.from(files))
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square group">
                  <img
                    src={preview || "/placeholder.svg"}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {uploadProgress[index] === 100 ? (
                    <div className="absolute inset-0 bg-primary/80 rounded-lg flex items-center justify-center">
                      <Check className="w-6 h-6 text-primary-foreground" />
                    </div>
                  ) : isUploading ? (
                    <div className="absolute inset-0 bg-foreground/50 rounded-lg flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-primary-foreground animate-spin" />
                    </div>
                  ) : (
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {files.length < 10 && !isUploading && (
                <button
                  onClick={open}
                  className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {files.length} van 10 foto's geselecteerd
            </p>
          </div>
        )}
      </div>

      <Button
        onClick={handleUpload}
        disabled={isUploading || files.length === 0 || !uploaderName.trim()}
        className="w-full h-12 text-base"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploaden...
          </>
        ) : (
          `Upload ${files.length > 0 ? files.length : ""} foto${files.length !== 1 ? "'s" : ""}`
        )}
      </Button>
    </div>
  )
}
