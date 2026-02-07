"use client"

import { Suspense } from "react"
import { Heart } from "lucide-react"
import { PhotoUpload } from "@/components/photo-upload"
import { Navigation } from "@/components/navigation"
import { AdminAccessButton } from "@/components/admin-access-button"
import { AuthErrorHandler } from "@/components/auth-error-handler"

export default function HomePage() {
  return (
    <main className="min-h-screen pb-20">
      {/* Catch auth errors that land on root URL */}
      <Suspense fallback={null}>
        <AuthErrorHandler />
      </Suspense>

      {/* Admin access button - top right */}
      <div className="absolute top-4 right-4 z-10">
        <AdminAccessButton />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Deel je foto's
          </h1>
          <p className="text-muted-foreground">
            Deel de mooiste momenten van deze bijzondere dag
          </p>
        </header>

        {/* Upload form */}
        <PhotoUpload />
      </div>
      
      <Navigation />
    </main>
  )
}
