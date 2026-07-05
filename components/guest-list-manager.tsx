"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Loader2,
  Search,
  UserPlus,
  Pencil,
  Trash2,
  Check,
  X,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { zetAanmeldingVoor } from "@/lib/guest"
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

type Role = "guest" | "vip" | "fotograaf" | "ceremony_master" | "admin"

interface GuestRow {
  id: string
  slug: string
  name: string
  phone: string | null
  role: Role
  label: string | null
  claimed_user_id: string | null
  aangemeld: boolean
}

const ROLE_OPTIONS: { value: Role; text: string }[] = [
  { value: "guest", text: "Gast" },
  { value: "vip", text: "VIP" },
  { value: "fotograaf", text: "Fotograaf" },
  { value: "ceremony_master", text: "Ceremoniemeester" },
  { value: "admin", text: "Admin" },
]

function roleText(role: Role): string {
  return ROLE_OPTIONS.find((o) => o.value === role)?.text ?? role
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "gast"
  )
}

function uniqueSlug(base: string, existing: Set<string>): string {
  let slug = base
  let i = 2
  while (existing.has(slug)) slug = `${base}-${i++}`
  return slug
}

export function GuestListManager() {
  const [guests, setGuests] = useState<GuestRow[] | "loading">("loading")
  const [query, setQuery] = useState("")

  // Add form
  const [addName, setAddName] = useState("")
  const [addRole, setAddRole] = useState<Role>("guest")
  const [addLabel, setAddLabel] = useState("")
  const [addPhone, setAddPhone] = useState("")
  const [adding, setAdding] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ name: string; phone: string; role: Role; label: string }>({
    name: "",
    phone: "",
    role: "guest",
    label: "",
  })
  const [saving, setSaving] = useState(false)

  const [deleteRow, setDeleteRow] = useState<GuestRow | null>(null)

  const fetchGuests = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("guests")
      .select("id, slug, name, phone, role, label, claimed_user_id, aangemeld")
      .order("name")
    if (!error && data) {
      setGuests(data as GuestRow[])
      return
    }
    // Fallback zolang migratie 007 (aangemeld-kolom) nog niet is uitgevoerd.
    const legacy = await supabase
      .from("guests")
      .select("id, slug, name, phone, role, label, claimed_user_id")
      .order("name")
    if (legacy.error) {
      console.error(legacy.error)
      toast.error("Kon de gastenlijst niet laden")
      return
    }
    setGuests((legacy.data || []).map((g) => ({ ...g, aangemeld: false })) as GuestRow[])
  }

  useEffect(() => {
    fetchGuests()
    const supabase = createClient()
    const channel = supabase
      .channel("admin-guests-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () => fetchGuests())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const list = guests === "loading" ? [] : guests

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.label ?? "").toLowerCase().includes(q) ||
        (g.phone ?? "").includes(q),
    )
  }, [list, query])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = addName.trim()
    if (!name) {
      toast.error("Vul een naam in")
      return
    }
    setAdding(true)
    const supabase = createClient()
    const existing = new Set(list.map((g) => g.slug))
    const slug = uniqueSlug(slugify(name), existing)

    const { error } = await supabase.from("guests").insert({
      slug,
      name,
      role: addRole,
      label: addLabel.trim() || null,
      phone: addPhone.trim() || null,
    })
    setAdding(false)

    if (error) {
      console.error(error)
      toast.error("Toevoegen mislukt")
      return
    }
    toast.success(`${name} toegevoegd`)
    setAddName("")
    setAddRole("guest")
    setAddLabel("")
    setAddPhone("")
    fetchGuests()
  }

  const startEdit = (g: GuestRow) => {
    setEditingId(g.id)
    setDraft({ name: g.name, phone: g.phone ?? "", role: g.role, label: g.label ?? "" })
  }

  const handleSaveEdit = async (id: string) => {
    const name = draft.name.trim()
    if (!name) {
      toast.error("Naam mag niet leeg zijn")
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("guests")
      .update({
        name,
        phone: draft.phone.trim() || null,
        role: draft.role,
        label: draft.label.trim() || null,
      })
      .eq("id", id)
    setSaving(false)

    if (error) {
      console.error(error)
      toast.error("Opslaan mislukt")
      return
    }
    toast.success("Gast bijgewerkt")
    setEditingId(null)
    fetchGuests()
  }

  const toggleAangemeld = async (g: GuestRow) => {
    try {
      await zetAanmeldingVoor(g.slug, !g.aangemeld)
      setGuests((prev) =>
        prev === "loading"
          ? prev
          : prev.map((row) => (row.id === g.id ? { ...row, aangemeld: !g.aangemeld } : row)),
      )
    } catch (err) {
      console.error(err)
      toast.error("Aanmelding wijzigen mislukt (is migratie 007 al uitgevoerd?)")
    }
  }

  const confirmDelete = async () => {
    if (!deleteRow) return
    const supabase = createClient()
    const { error } = await supabase.from("guests").delete().eq("id", deleteRow.id)
    if (error) {
      console.error(error)
      toast.error("Verwijderen mislukt")
    } else {
      toast.success(`${deleteRow.name} verwijderd`)
      fetchGuests()
    }
    setDeleteRow(null)
  }

  return (
    <div>
      {/* Nieuwe gast */}
      <form
        onSubmit={handleAdd}
        className="mb-5 rounded-lg border border-border bg-card p-4 space-y-3"
      >
        <div className="flex items-center gap-2 font-medium">
          <UserPlus className="w-4 h-4 text-primary" /> Nieuwe gast toevoegen
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="add-name" className="text-xs">Naam</Label>
            <Input id="add-name" value={addName} onChange={(e) => setAddName(e.target.value)} className="h-10" placeholder="Naam zoals op het inlogscherm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-phone" className="text-xs">Telefoon (optioneel)</Label>
            <Input id="add-phone" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} className="h-10" placeholder="06..." />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-role" className="text-xs">Rol</Label>
            <select
              id="add-role"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as Role)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.text}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-label" className="text-xs">Badge (optioneel)</Label>
            <Input id="add-label" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} className="h-10" placeholder="bijv. bruid, bruidegom" />
          </div>
        </div>
        <Button type="submit" disabled={adding} className="gap-2">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Toevoegen
        </Button>
      </form>

      {/* Zoeken */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op naam, badge of telefoon..."
          className="pl-10 h-10"
        />
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {list.length} gasten op de lijst, {list.filter((g) => g.aangemeld).length} aangemeld
        {query && ` (${filtered.length} gevonden)`}
      </p>

      {guests === "loading" ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Geen gasten gevonden</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) =>
            editingId === g.id ? (
              <div key={g.id} className="rounded-lg border border-primary/40 bg-card p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Naam</Label>
                    <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefoon</Label>
                    <Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rol</Label>
                    <select
                      value={draft.role}
                      onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as Role }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.text}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Badge</Label>
                    <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} className="h-10" placeholder="bijv. bruid" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSaveEdit(g.id)} disabled={saving} className="gap-1">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Opslaan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="gap-1">
                    <X className="w-4 h-4" /> Annuleer
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{g.name}</span>
                    {g.role !== "guest" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {roleText(g.role)}
                      </span>
                    )}
                    {g.label && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {g.label}
                      </span>
                    )}
                    {g.claimed_user_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Heeft al ingelogd">
                        <CheckCircle2 className="w-3 h-3 text-primary" /> ingelogd
                      </span>
                    )}
                  </div>
                  {g.phone && <p className="text-xs text-muted-foreground truncate">{g.phone}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleAangemeld(g)}
                    title={g.aangemeld ? "Aangemeld (klik om af te melden)" : "Niet aangemeld (klik om aan te melden)"}
                    className={
                      g.aangemeld
                        ? "text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground font-medium"
                        : "text-xs px-2 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted"
                    }
                  >
                    {g.aangemeld ? "Aangemeld" : "Aanmelden"}
                  </button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(g)} title="Bewerk">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteRow(g)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Verwijder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <AlertDialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gast verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRow?.name} wordt van de gastenlijst verwijderd en kan dan niet meer inloggen.
              Hun eventueel al geüploade foto&apos;s blijven staan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Verwijder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
