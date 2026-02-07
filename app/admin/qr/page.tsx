"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Printer, QrCode, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

// Simple QR code generator using Canvas
// Based on QR code encoding algorithm for alphanumeric content
function generateQRCodeURL(text: string, size: number = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png&margin=8`
}

export default function QRCodePage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [siteUrl, setSiteUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const checkAuth = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/admin/login")
      return
    }
    setIsAuthenticated(true)
  }, [router])

  useEffect(() => {
    checkAuth()
    setSiteUrl(window.location.origin)
  }, [checkAuth])

  const handleDownload = async () => {
    try {
      const qrUrl = generateQRCodeURL(siteUrl, 600)
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement("a")
      link.href = url
      link.download = "trouw-foto-app-qr.png"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success("QR-code gedownload")
    } catch {
      toast.error("Download mislukt")
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl)
      setCopied(true)
      toast.success("URL gekopieerd")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Kopiëren mislukt")
    }
  }

  if (!isAuthenticated) return null

  const qrImageUrl = generateQRCodeURL(siteUrl, 300)

  return (
    <>
      <main className="min-h-screen pb-8 bg-background print:bg-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Header - hidden when printing */}
          <div className="print:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin")}
              className="mb-4 gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Terug naar dashboard
            </Button>
          </div>

          {/* QR Card */}
          <Card className="print:shadow-none print:border-none">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 print:hidden">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="font-serif text-2xl">
                Deel de fotoapp
              </CardTitle>
              <CardDescription>
                Laat gasten deze QR-code scannen om foto&apos;s te uploaden
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col items-center gap-6">
              {/* QR Code Image */}
              <div className="bg-white p-4 rounded-xl border border-border">
                {siteUrl && (
                  <img
                    src={qrImageUrl}
                    alt="QR-code naar de trouw foto app"
                    width={250}
                    height={250}
                    className="print:w-64 print:h-64"
                  />
                )}
              </div>

              {/* URL display */}
              <div className="w-full flex items-center gap-2 rounded-lg bg-muted p-3">
                <code className="flex-1 text-sm text-foreground truncate">
                  {siteUrl}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="shrink-0 print:hidden"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Instructions for guests */}
              <div className="w-full rounded-lg bg-secondary/50 p-4 text-center print:bg-transparent">
                <p className="text-sm font-medium text-secondary-foreground mb-1">
                  Instructies voor gasten
                </p>
                <p className="text-sm text-muted-foreground">
                  Scan de QR-code met je telefoon camera, vul je naam in, en
                  upload je mooiste foto&apos;s van de dag.
                </p>
              </div>

              {/* Action buttons - hidden when printing */}
              <div className="w-full flex flex-col gap-2 print:hidden">
                <Button onClick={handleDownload} className="w-full h-12 gap-2">
                  <Download className="w-4 h-4" />
                  Download QR-code
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  className="w-full h-12 gap-2 bg-transparent"
                >
                  <Printer className="w-4 h-4" />
                  Print deze pagina
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Print-only footer */}
      <div className="hidden print:block text-center mt-4">
        <p className="text-xs text-muted-foreground">
          Scan de QR-code om foto&apos;s te delen
        </p>
      </div>
    </>
  )
}
