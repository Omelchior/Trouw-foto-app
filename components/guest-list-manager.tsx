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
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { zetAanwezigheidVoor, AANWEZIGHEID_OPTIES, type Aanwezigheid } from "@/lib/guest"
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
  aanwezigheid: Aanwezigheid
  groep: string | null
  dagdeel: "dag" | "avond" | null
  dieetwensen: string | null
  eerste_opdracht: number | null
  opmerkingen: string | null
  relatie: string | null
  naamkaartje: string | null
  tafel: number | null
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

const AANWEZIGHEID_KLEUR: Record<Aanwezigheid, string> = {
  aangemeld: "border-primary bg-primary/10 text-primary",
  waarschijnlijk: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  onzeker: "border-border bg-muted text-muted-foreground",
  afwezig: "border-destructive/40 bg-destructive/10 text-destructive",
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

const VELDEN =
  "id, slug, name, phone, role, label, claimed_user_id, aanwezigheid, groep, dagdeel, dieetwensen, eerste_opdracht, opmerkingen, relatie, naamkaartje, tafel"

interface Draft {
  name: string
  phone: string
  role: Role
  label: string
  groep: string
  dagdeel: "" | "dag" | "avond"
  dieetwensen: string
  eerste_opdracht: string
  opmerkingen: string
  relatie: string
  naamkaartje: string
  tafel: string
}

function toDraft(g: GuestRow): Draft {
  return {
    name: g.name,
    phone: g.phone ?? "",
    role: g.role,
    label: g.label ?? "",
    groep: g.groep ?? "",
    dagdeel: g.dagdeel ?? "",
    dieetwensen: g.dieetwensen ?? "",
    eerste_opdracht: g.eerste_opdracht?.toString() ?? "",
    opmerkingen: g.opmerkingen ?? "",
    relatie: g.relatie ?? "",
    naamkaartje: g.naamkaartje ?? "",
    tafel: g.tafel?.toString() ?? "",
  }
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
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteRow, setDeleteRow] = useState<GuestRow | null>(null)

  const fetchGuests = async () => {
    const supabase = createClient()
    const { data, error } = await supabase.from("guests").select(VELDEN).order("name")
    if (!error && data) {
      setGuests(data as unknown as GuestRow[])
      return
    }
    console.error(error)
    toast.error("Kon de gastenlijst niet laden (is migratie 009 al uitgevoerd?)")
    setGuests([])
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
        (g.phone ?? "").includes(q) ||
        (g.groep ?? "").toLowerCase().includes(q) ||
        (g.relatie ?? "").toLowerCase().includes(q),
    )
  }, [list, query])

  const telling = useMemo(() => {
    const t: Record<Aanwezigheid, number> = { aangemeld: 0, waarschijnlijk: 0, onzeker: 0, afwezig: 0 }
    list.forEach((g) => { t[g.aanwezigheid] += 1 })
    return t
  }, [list])

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
    setDraft(toDraft(g))
  }

  const zetVeld = (veld: keyof Draft, waarde: string) => {
    setDraft((d) => (d ? { ...d, [veld]: waarde } : d))
  }

  const handleSaveEdit = async (id: string) => {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      toast.error("Naam mag niet leeg zijn")
      return
    }
    const opdracht = draft.eerste_opdracht.trim() ? parseInt(draft.eerste_opdracht, 10) : null
    if (opdracht !== null && (isNaN(opdracht) || opdracht < 1 || opdracht > 25)) {
      toast.error("Eerste opdracht moet een nummer van 1 t/m 25 zijn")
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
        groep: draft.groep.trim() || null,
        dagdeel: draft.dagdeel || null,
        dieetwensen: draft.dieetwensen.trim() || null,
        eerste_opdracht: opdracht,
        opmerkingen: draft.opmerkingen.trim() || null,
        relatie: draft.relatie.trim() || null,
        naamkaartje: draft.naamkaartje.trim() || null,
        tafel: draft.tafel ? parseInt(draft.tafel, 10) : null,
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
    setDraft(null)
    fetchGuests()
  }

  const handleAanwezigheid = async (g: GuestRow, status: Aanwezigheid) => {
    try {
      await zetAanwezigheidVoor(g.slug, status)
      setGuests((prev) =>
        prev === "loading"
          ? prev
          : prev.map((row) => (row.id === g.id ? { ...row, aanwezigheid: status } : row)),
      )
    } catch (err) {
      console.error(err)
      toast.error("Aanwezigheid wijzigen mislukt")
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
            <Input id="add-label" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} className="h-10" placeholder="bijv. bruid, getuige" />
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
          placeholder="Zoek op naam, groep, relatie, badge of telefoon..."
          className="pl-10 h-10"
        />
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {list.length} gasten: {telling.aangemeld} aangemeld, {telling.waarschijnlijk} waarschijnlijk,{" "}
        {telling.onzeker} onzeker, {telling.afwezig} afwezig
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
            editingId === g.id && draft ? (
              <div key={g.id} className="rounded-lg border border-primary/40 bg-card p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Naam</Label>
                    <Input value={draft.name} onChange={(e) => zetVeld("name", e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefoon</Label>
                    <Input value={draft.phone} onChange={(e) => zetVeld("phone", e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rol</Label>
                    <select
                      value={draft.role}
                      onChange={(e) => zetVeld("role", e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.text}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Badge</Label>
                    <Input value={draft.label} onChange={(e) => zetVeld("label", e.target.value)} className="h-10" placeholder="bijv. bruid, getuige" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Groep</Label>
                    <Input value={draft.groep} onChange={(e) => zetVeld("groep", e.target.value)} className="h-10" placeholder="bijv. Fam. Melchior" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dag- of avondgast</Label>
                    <select
                      value={draft.dagdeel}
                      onChange={(e) => zetVeld("dagdeel", e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Nog onbekend</option>
                      <option value="dag">Dag + avond</option>
                      <option value="avond">Avond</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tafel</Label>
                    <select
                      value={draft.tafel}
                      onChange={(e) => zetVeld("tafel", e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Geen tafel</option>
                      {[1, 2, 3, 4, 5].map((t) => (
                        <option key={t} value={t}>Tafel {t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Eerste foto-opdracht (1-25)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={25}
                      value={draft.eerste_opdracht}
                      onChange={(e) => zetVeld("eerste_opdracht", e.target.value)}
                      className="h-10"
                      placeholder="bijv. 7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Allergieën & dieetwensen</Label>
                    <Input value={draft.dieetwensen} onChange={(e) => zetVeld("dieetwensen", e.target.value)} className="h-10" placeholder="bijv. vega, notenallergie" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Relatie met bruidspaar</Label>
                    <Input value={draft.relatie} onChange={(e) => zetVeld("relatie", e.target.value)} className="h-10" placeholder="bijv. Neef Olaf" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Opmerkingen</Label>
                    <Input value={draft.opmerkingen} onChange={(e) => zetVeld("opmerkingen", e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Naamkaartje-tekst</Label>
                    <Textarea
                      value={draft.naamkaartje}
                      onChange={(e) => zetVeld("naamkaartje", e.target.value)}
                      rows={2}
                      className="resize-none"
                      placeholder="Persoonlijke tekst voor op het naamkaartje"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSaveEdit(g.id)} disabled={saving} className="gap-1">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Opslaan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setDraft(null) }} className="gap-1">
                    <X className="w-4 h-4" /> Annuleer
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={g.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
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
                    {g.dagdeel && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {g.dagdeel === "dag" ? "Dag + avond" : "Avond"}
                      </span>
                    )}
                    {g.tafel && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Tafel {g.tafel}
                      </span>
                    )}
                    {g.claimed_user_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Heeft al ingelogd">
                        <CheckCircle2 className="w-3 h-3 text-primary" /> ingelogd
                      </span>
                    )}
                  </div>
                  {(g.groep || g.relatie || g.phone) && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[g.groep, g.relatie, g.phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {(g.dieetwensen || g.eerste_opdracht || g.opmerkingen) && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[
                        g.dieetwensen && `Dieet: ${g.dieetwensen}`,
                        g.eerste_opdracht && `Opdracht #${g.eerste_opdracht}`,
                        g.opmerkingen,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={g.aanwezigheid}
                    onChange={(e) => handleAanwezigheid(g, e.target.value as Aanwezigheid)}
                    title="Aanwezigheid"
                    className={`text-xs px-1.5 py-1 rounded-full border font-medium ${AANWEZIGHEID_KLEUR[g.aanwezigheid]}`}
                  >
                    {AANWEZIGHEID_OPTIES.map((o) => (
                      <option key={o.value} value={o.value}>{o.tekst}</option>
                    ))}
                  </select>
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
