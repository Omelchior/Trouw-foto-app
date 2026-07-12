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
  MessageSquare,
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
  aangemeld: "border-green-600 bg-green-600 text-white font-semibold",
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

  // Filters
  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"" | Aanwezigheid>("")
  const [filterGroep, setFilterGroep] = useState("")
  const [filterDagdeel, setFilterDagdeel] = useState<"" | "dag" | "avond" | "alleen-avond">("")
  const [filterOpdracht, setFilterOpdracht] = useState("")

  // Add form
  const [addName, setAddName] = useState("")
  const [addRole, setAddRole] = useState<Role>("guest")
  const [addLabel, setAddLabel] = useState("")
  const [addPhone, setAddPhone] = useState("")
  const [adding, setAdding] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

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

  const groepen = useMemo(
    () => Array.from(new Set(list.map((g) => g.groep).filter(Boolean) as string[])).sort(),
    [list],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((g) => {
      if (filterStatus && g.aanwezigheid !== filterStatus) return false
      if (filterGroep && g.groep !== filterGroep) return false
      // Elke daggast is ook avondgast: het avond-filter telt daggasten mee.
      if (filterDagdeel === "dag" && g.dagdeel !== "dag") return false
      if (filterDagdeel === "avond" && g.dagdeel !== "dag" && g.dagdeel !== "avond") return false
      if (filterDagdeel === "alleen-avond" && g.dagdeel !== "avond") return false
      if (filterOpdracht && g.eerste_opdracht !== parseInt(filterOpdracht, 10)) return false
      if (!q) return true
      return (
        g.name.toLowerCase().includes(q) ||
        (g.label ?? "").toLowerCase().includes(q) ||
        (g.phone ?? "").includes(q) ||
        (g.groep ?? "").toLowerCase().includes(q) ||
        (g.relatie ?? "").toLowerCase().includes(q) ||
        (g.opmerkingen ?? "").toLowerCase().includes(q) ||
        (g.dieetwensen ?? "").toLowerCase().includes(q)
      )
    })
  }, [list, query, filterStatus, filterGroep, filterDagdeel, filterOpdracht])

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

  const kolommen = 7

  return (
    <div>
      {/* Nieuwe gast */}
      {addOpen ? (
        <form
          onSubmit={handleAdd}
          className="mb-5 rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <UserPlus className="w-4 h-4 text-primary" /> Nieuwe gast toevoegen
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => setAddOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
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
      ) : (
        <div className="mb-5">
          <Button variant="outline" onClick={() => setAddOpen(true)} className="gap-2 bg-transparent">
            <UserPlus className="w-4 h-4" /> Nieuwe gast toevoegen
          </Button>
        </div>
      )}

      {/* Filterbalk */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op naam, groep, relatie, dieet..."
            className="pl-10 h-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "" | Aanwezigheid)}
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          title="Filter op aanwezigheid"
        >
          <option value="">Alle statussen</option>
          {AANWEZIGHEID_OPTIES.map((o) => (
            <option key={o.value} value={o.value}>{o.tekst}</option>
          ))}
        </select>
        <select
          value={filterGroep}
          onChange={(e) => setFilterGroep(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          title="Filter op groep"
        >
          <option value="">Alle groepen</option>
          {groepen.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={filterDagdeel}
          onChange={(e) => setFilterDagdeel(e.target.value as "" | "dag" | "avond" | "alleen-avond")}
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          title="Filter op dag- of avondgast"
        >
          <option value="">Alle gasten</option>
          <option value="dag">Daggasten</option>
          <option value="avond">Avondgasten (incl. dag)</option>
          <option value="alleen-avond">Alleen avond</option>
        </select>
        <select
          value={filterOpdracht}
          onChange={(e) => setFilterOpdracht(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          title="Filter op eerste foto-opdracht"
        >
          <option value="">Alle opdrachten</option>
          {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>Opdracht #{n}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {filtered.length} van {list.length} gasten · {telling.aangemeld} aangemeld,{" "}
        {telling.waarschijnlijk} waarschijnlijk, {telling.onzeker} onzeker, {telling.afwezig} afwezig
      </p>

      {guests === "loading" ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Geen gasten gevonden</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Naam</th>
                <th className="px-3 py-2 font-medium">Aanwezigheid</th>
                <th className="px-3 py-2 font-medium">Tafel</th>
                <th className="px-3 py-2 font-medium">Dieet</th>
                <th className="px-3 py-2 font-medium">Relatie</th>
                <th className="px-3 py-2 font-medium">Naamkaartje</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((g) =>
                editingId === g.id && draft ? (
                  <tr key={g.id}>
                    <td colSpan={kolommen} className="p-3 bg-primary/5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
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
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleSaveEdit(g.id)} disabled={saving} className="gap-1">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Opslaan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setDraft(null) }} className="gap-1">
                          <X className="w-4 h-4" /> Annuleer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={g.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium whitespace-nowrap">{g.name}</span>
                        {g.role !== "guest" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                            {roleText(g.role)}
                          </span>
                        )}
                        {g.label && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground whitespace-nowrap">
                            {g.label}
                          </span>
                        )}
                        {g.claimed_user_id && (
                          <CheckCircle2 className="w-3 h-3 text-primary shrink-0" aria-label="Heeft al ingelogd" />
                        )}
                        {g.opmerkingen && (
                          <MessageSquare className="w-3 h-3 text-amber-600 shrink-0" aria-label={g.opmerkingen} />
                        )}
                      </div>
                      {g.phone && (
                        <p className="text-xs text-muted-foreground whitespace-nowrap">{g.phone}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={g.aanwezigheid}
                        onChange={(e) => handleAanwezigheid(g, e.target.value as Aanwezigheid)}
                        className={`text-xs px-1.5 py-1 rounded-full border font-medium ${AANWEZIGHEID_KLEUR[g.aanwezigheid]}`}
                      >
                        {AANWEZIGHEID_OPTIES.map((o) => (
                          <option key={o.value} value={o.value}>{o.tekst}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{g.tafel ?? ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground max-w-[10rem] truncate" title={g.dieetwensen ?? undefined}>
                      {g.dieetwensen ?? ""}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[14rem] truncate" title={[g.relatie, g.opmerkingen].filter(Boolean).join(" · ") || undefined}>
                      {g.relatie ?? ""}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[14rem] truncate" title={g.naamkaartje ?? undefined}>
                      {g.naamkaartje ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-0.5 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(g)} title="Bewerk" className="h-8 w-8">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteRow(g)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Verwijder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
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
