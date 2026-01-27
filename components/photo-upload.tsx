"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Camera, Upload, X, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
    setFiles((prev) => [...prev, ...newFiles])
    
    newFiles.forEach((file) => {
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

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("wedding-photos")
          .upload(fileName, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("wedding-photos")
          .getPublicUrl(fileName)

        // Save to database
        const { error: dbError } = await supabase
          .from("photos")
          .insert({
            storage_path: fileName,
            uploaded_by: uploaderName.trim()
          })

        if (dbError) throw dbError

        setUploadProgress((prev) => {
          const newProgress = [...prev]
          newProgress[i] = 100
          return newProgress
        })
      }

      toast.success(`${files.length} foto${files.length > 1 ? "'s" : ""} geupload!`)
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
