"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, ChevronLeft, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

/**
 * Draaiboek voor de trouwdag: één grote vrije tekst, alleen zichtbaar en
 * bewerkbaar voor beheer en ceremoniemeesters (afgedwongen via RLS).
 */
export default function DraaiboekPage() {
  const router = useRouter()
  const [tekst, setTekst] = useState("")
  const [origineel, setOrigineel] = useState("")
  const [laden, setLaden] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [bijgewerkt, setBijgewerkt] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("beheer_teksten")
        .select("inhoud, bijgewerkt_op")
        .eq("sleutel", "draaiboek")
        .maybeSingle()
      if (error) {
        console.error(error)
        toast.error("Kon het draaiboek niet laden (is migratie 009 al uitgevoerd?)")
      } else if (data) {
        setTekst(data.inhoud)
        setOrigineel(data.inhoud)
        setBijgewerkt(data.bijgewerkt_op)
      }
      setLaden(false)
    }
    load()
  }, [])

  const handleOpslaan = async () => {
    setOpslaan(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("beheer_teksten")
      .upsert({ sleutel: "draaiboek", inhoud: tekst, bijgewerkt_op: new Date().toISOString() })
    setOpslaan(false)

    if (error) {
      console.error(error)
      toast.error("Opslaan mislukt")
      return
    }
    setOrigineel(tekst)
    setBijgewerkt(new Date().toISOString())
    toast.success("Draaiboek opgeslagen")
  }

  const gewijzigd = tekst !== origineel

  return (
    <main className="min-h-screen pb-12 bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">Draaiboek</h1>
              <p className="text-sm text-muted-foreground">
                Alleen zichtbaar voor beheer en ceremoniemeesters
                {bijgewerkt &&
                  ` · laatst bijgewerkt ${new Date(bijgewerkt).toLocaleString("nl-NL", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}`}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/admin")} className="gap-2 bg-transparent">
            <ChevronLeft className="w-4 h-4" /> Terug naar beheer
          </Button>
        </header>

        {laden ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              rows={24}
              placeholder={
                "Schrijf hier het draaiboek voor de trouwdag...\n\nBijvoorbeeld:\n13:30  Ceremoniemeesters aanwezig op Mereveld\n14:00  Ontvangst gasten\n14:25  Gasten nemen plaats voor de ceremonie\n..."
              }
              className="font-mono text-sm leading-relaxed"
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleOpslaan} disabled={opslaan || !gewijzigd} className="gap-2">
                {opslaan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Opslaan
              </Button>
              {gewijzigd && (
                <span className="text-xs text-muted-foreground">Niet-opgeslagen wijzigingen</span>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
