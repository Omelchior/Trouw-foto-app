"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Shield,
  Loader2,
  LogOut,
  Images,
  MessageCircle,
  Download,
  Trash2,
  CheckSquare,
  Square,
  QrCode,
  MessageCircleQuestion,
  Users,
  Heart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PhotoGrid } from "@/components/photo-grid"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { GuestbookFeed } from "@/components/guestbook-feed"
import { QaFeed, type QaEntry } from "@/components/qa-feed"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Photo {
  id: string
  storage_path: string
  uploaded_by: string
  uploaded_at: string
  is_selected: boolean
  url?: string
}

interface GuestbookEntry {
  id: string
  guest_name: string
  message: string
  created_at: string
}

interface UserProfileRow {
  user_id: string
  name: string
  role: "guest" | "vip" | "ceremony_master" | "admin"
  email: string | null
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([])
  const [qaEntries, setQaEntries] = useState<QaEntry[]>([])
  const [users, setUsers] = useState<UserProfileRow[]>([])
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [activeTab, setActiveTab] = useState("photos")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: "photo" | "guestbook" | "qa", id: string } | null>(null)

  const checkAuth = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push("/admin/login")
      return
    }

    setIsAuthenticated(true)
    setIsLoading(false)
  }, [router])

  const fetchPhotos = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("uploaded_at", { ascending: false })

    if (error) {
      console.error("Error fetching photos:", error)
    } else {
      const photosWithUrls = (data || []).map(photo => ({
        ...photo,
        url: supabase.storage.from("wedding-photos").getPublicUrl(photo.storage_path).data.publicUrl
      }))
      setPhotos(photosWithUrls)
    }
  }

  const fetchGuestbook = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("guestbook_entries")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching guestbook:", error)
    } else {
      setGuestbookEntries(data || [])
    }
  }

  // Admins only see public questions (is_secret = false)
  const fetchQa = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("qa_questions")
      .select("id, guest_name, question, is_secret, answer, answered_at, created_at")
      .eq("is_secret", false)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching Q&A:", error)
    } else {
      setQaEntries((data || []) as QaEntry[])
    }
  }

  const fetchUsers = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id, name, role, email, created_at")
      .order("created_at", { ascending: false })
    if (error) {
      console.error(error)
    } else {
      setUsers((data || []) as UserProfileRow[])
    }
  }

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) return

    fetchPhotos()
    fetchGuestbook()
    fetchQa()
    fetchUsers()

    const supabase = createClient()

    const photosChannel = supabase
      .channel("admin-photos-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, () => fetchPhotos())
      .subscribe()

    const guestbookChannel = supabase
      .channel("admin-guestbook-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "guestbook_entries" }, () => fetchGuestbook())
      .subscribe()

    const qaChannel = supabase
      .channel("admin-qa-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_questions" }, () => fetchQa())
      .subscribe()

    const usersChannel = supabase
      .channel("admin-users-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles" }, () => fetchUsers())
      .subscribe()

    return () => {
      supabase.removeChannel(photosChannel)
      supabase.removeChannel(guestbookChannel)
      supabase.removeChannel(qaChannel)
      supabase.removeChannel(usersChannel)
    }
  }, [isAuthenticated])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  const handleDeletePhoto = async (id: string) => {
    setItemToDelete({ type: "photo", id })
    setDeleteDialogOpen(true)
  }

  const handleDeleteGuestbook = async (id: string) => {
    setItemToDelete({ type: "guestbook", id })
    setDeleteDialogOpen(true)
  }

  const handleDeleteQa = async (id: string) => {
    setItemToDelete({ type: "qa", id })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return
    const supabase = createClient()

    try {
      if (itemToDelete.type === "photo") {
        const photo = photos.find(p => p.id === itemToDelete.id)
        if (photo) {
          await supabase.storage.from("wedding-photos").remove([photo.storage_path])
          const { error } = await supabase.from("photos").delete().eq("id", itemToDelete.id)
          if (error) throw error
          toast.success("Foto verwijderd")
          fetchPhotos()
        }
      } else if (itemToDelete.type === "guestbook") {
        const { error } = await supabase.from("guestbook_entries").delete().eq("id", itemToDelete.id)
        if (error) throw error
        toast.success("Bericht verwijderd")
        fetchGuestbook()
      } else if (itemToDelete.type === "qa") {
        const { error } = await supabase.from("qa_questions").delete().eq("id", itemToDelete.id)
        if (error) throw error
        toast.success("Vraag verwijderd")
        fetchQa()
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Verwijderen mislukt")
    } finally {
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const handleToggleSelection = async (id: string, selected: boolean) => {
    const supabase = createClient()
    const { error } = await supabase.from("photos").update({ is_selected: selected }).eq("id", id)
    if (error) {
      toast.error("Selectie aanpassen mislukt")
    } else {
      fetchPhotos()
    }
  }

  const handleBulkToggleSelection = async (select: boolean) => {
    if (selectedIds.size === 0) return
    const supabase = createClient()
    const { error } = await supabase.from("photos").update({ is_selected: select }).in("id", Array.from(selectedIds))
    if (error) {
      toast.error("Selectie aanpassen mislukt")
    } else {
      toast.success(`${selectedIds.size} foto's ${select ? "geselecteerd" : "gedeselecteerd"}`)
      setSelectedIds(new Set())
      setSelectionMode(false)
      fetchPhotos()
    }
  }

  const handleDownloadSelected = () => {
    const selectedPhotos = photos.filter(p => selectedIds.has(p.id))
    selectedPhotos.forEach(photo => {
      window.open(photo.url, '_blank')
    })
  }

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const handleRoleChange = async (userId: string, role: UserProfileRow["role"]) => {
    const supabase = createClient()
    const { error } = await supabase.from("user_profiles").update({ role }).eq("user_id", userId)
    if (error) {
      console.error(error)
      toast.error("Rol aanpassen mislukt")
    } else {
      toast.success("Rol aangepast")
      fetchUsers()
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const selectedPhotos = photos.filter(p => p.is_selected)
  const openQaCount = qaEntries.filter(q => !q.answer).length

  return (
    <main className="min-h-screen pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {photos.length} foto's, {selectedPhotos.length} geselecteerd
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/rsvp")} className="gap-2 bg-transparent">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">RSVP</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/qr")} className="gap-2 bg-transparent">
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">QR-code</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 bg-transparent">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Uitloggen</span>
            </Button>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="photos" className="gap-2">
              <Images className="w-4 h-4" />
              <span className="hidden sm:inline">Foto's</span>
              <span>({photos.length})</span>
            </TabsTrigger>
            <TabsTrigger value="guestbook" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Gastenboek</span>
              <span>({guestbookEntries.length})</span>
            </TabsTrigger>
            <TabsTrigger value="qa" className="gap-2">
              <MessageCircleQuestion className="w-4 h-4" />
              <span className="hidden sm:inline">Vragen</span>
              <span>({openQaCount})</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Gebruikers</span>
              <span>({users.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                variant={selectionMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectionMode(!selectionMode)
                  setSelectedIds(new Set())
                }}
                className="gap-2"
              >
                {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectionMode ? "Annuleer" : "Selecteer"}
              </Button>

              {selectionMode && selectedIds.size > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleBulkToggleSelection(true)} className="gap-2">
                    Markeer geselecteerd
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkToggleSelection(false)} className="gap-2">
                    Deselecteer
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadSelected} className="gap-2 bg-transparent">
                    <Download className="w-4 h-4" />
                    Download ({selectedIds.size})
                  </Button>
                </>
              )}
            </div>

            <PhotoGrid
              photos={photos}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectId}
              onPhotoClick={selectionMode ? undefined : setLightboxPhoto}
              isAdmin={!selectionMode}
              onDelete={handleDeletePhoto}
              onToggleSelection={handleToggleSelection}
            />
          </TabsContent>

          <TabsContent value="guestbook">
            <GuestbookFeed
              entries={guestbookEntries}
              isAdmin
              onDelete={handleDeleteGuestbook}
            />
          </TabsContent>

          <TabsContent value="qa">
            <p className="text-xs text-muted-foreground mb-3">
              Alleen openbare vragen worden hier getoond. Vragen die gemarkeerd zijn als &quot;geheim voor het bruidspaar&quot; zijn alleen zichtbaar voor ceremoniemeesters.
            </p>
            <div className="space-y-3">
              <QaFeed entries={qaEntries} emptyText="Nog geen openbare vragen" />
              {qaEntries.length > 0 && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Vragen verwijderen?{" "}
                  {qaEntries.map(e => (
                    <button
                      key={e.id}
                      onClick={() => handleDeleteQa(e.id)}
                      className="inline-flex items-center gap-1 ml-2 text-destructive hover:underline"
                    >
                      <Trash2 className="w-3 h-3" /> #{e.id.slice(0, 4)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <p className="text-xs text-muted-foreground mb-3">
              Wijzig een gebruikers rol via het dropdown. Ceremoniemeester / admin accounts moeten eerst in Supabase
              Dashboard met email+wachtwoord worden aangemaakt.
            </p>
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center justify-between gap-3 border border-border rounded-lg p-3 bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email ?? <span className="italic">anoniem</span>}
                    </p>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.user_id, e.target.value as UserProfileRow["role"])}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="guest">Gast</option>
                    <option value="vip">VIP</option>
                    <option value="ceremony_master">Ceremoniemeester</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-center text-muted-foreground py-12 text-sm">Nog geen gebruikers</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <PhotoLightbox
        photo={lightboxPhoto}
        photos={photos}
        onClose={() => setLightboxPhoto(null)}
        onNavigate={setLightboxPhoto}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === "photo" && "Deze foto wordt permanent verwijderd."}
              {itemToDelete?.type === "guestbook" && "Dit bericht wordt permanent verwijderd."}
              {itemToDelete?.type === "qa" && "Deze vraag wordt permanent verwijderd."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="w-4 h-4 mr-2" />
              Verwijder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
