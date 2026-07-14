"use client"

import { useEffect, useState } from "react"
import { Info, Clock, MapPin, Shirt, Gift, Phone, BedDouble, UtensilsCrossed, Car, PartyPopper, TrainFront, Bird, Luggage, Wine, Sparkles, Ticket, Heart, Cake, Utensils, Music, Home, Hotel, Tent, Crown } from "lucide-react"

/** Twee trouwringen, in dezelfde lijnstijl als de lucide-iconen. */
function Ringen({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
    </svg>
  )
}
import { Navigation } from "@/components/navigation"
import { LogoutButton } from "@/components/logout-button"
import { PROGRAMMA, PROGRAMMA_AVOND, TROUWDATUM_TEKST } from "@/lib/bruiloft"
import { getMijnDagdeel } from "@/lib/guest"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// ─────────────────────────────────────────────────────────────
// Alle inhoud op één plek — pas hier de details aan.
// ─────────────────────────────────────────────────────────────
const PROGRAMMA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Aanvang: Heart,
  Ceremonie: Ringen,
  Taart: Cake,
  Borrel: Wine,
  Diner: Utensils,
  Feest: Music,
  Einde: Home,
}

const AVONDGASTEN =
  "Kom je voor het avondfeest? Vanaf 20:00 uur ben je welkom. Om 20:30 uur gaan we met een drankje in de hand met de voeten van de vloer."

const LOCATIE = {
  naam: "Mereveld",
  adres: "Mereveldseweg 9, Utrecht",
  mapsUrl: "https://maps.google.com/?q=Mereveld,+Mereveldseweg+9,+Utrecht",
  parkeren: "Parkeren is gratis. Er is voldoende parkeergelegenheid bij Mereveld.",
  ov: "Met het openbaar vervoer? Mereveld ligt op slechts 1 km (20 minuten lopen) van NS-station Utrecht Lunetten.",
}

const DRESSCODE = {
  code: "Feestelijk",
  toelichting: "Kleuren ter inspiratie:",
  kleuren: ["#4D5A76", "#97A37E", "#A8B7A1", "#F1F0E6", "#B8A773"],
  kleurenKlein: ["#648E6A", "#B4CAE1", "#C49A8E", "#D1A581", "#EADEAC"],
}

const CADEAUTIP = {
  intro:
    "Jullie aanwezigheid is voor ons het mooiste cadeau. Willen jullie ons toch graag verwennen? Wij sparen voor een mooie serviesset, een bijdrage hieraan wordt gewaardeerd.",
  intro2:
    "Toch liever iets anders geven? Wij worden ook heel blij van bijzondere ervaringen samen. Met één van deze belevenissen, of een bijdrage hieraan, maken jullie ons ook ontzettend blij:",
  belevenissen: [
    { icon: Bird, tekst: "Vogelexcursie of natuurwandeling met gids" },
    { icon: Luggage, tekst: "Weekendje weg in Nederland" },
    { icon: UtensilsCrossed, tekst: "Dinerbon voor een mooi restaurant" },
    { icon: Wine, tekst: "Wijnproeverij of speciaalbierproeverij" },
    { icon: Sparkles, tekst: "Sauna- of wellnessdag" },
    { icon: Ticket, tekst: "Tickets voor een voorstelling" },
  ],
  outro: "Er staat een enveloppendoos bij de ingang.",
}

const PRAKTISCH = [
  {
    icon: Crown,
    titel: "Ceremoniemeesters",
    tekst: "Vragen op de dag zelf? Bel of app de ceremoniemeesters:",
    contacten: [
      { naam: "Anton Melchior", telefoon: "06-420 605 57" },
      { naam: "Sira de Waard", telefoon: "06-294 289 07" },
    ],
  },
  {
    icon: UtensilsCrossed,
    titel: "Allergieën & dieetwensen",
    tekst: "Laat dieetwensen of allergieën vóór 31 juli even weten via:",
    contacten: [
      { naam: "Olaf Melchior", telefoon: "06-250 600 54" },
      { naam: "Ester Doorlag", telefoon: "06-316 428 88" },
    ],
  },
]

const OVERNACHTEN = {
  tekst:
    "Wij overnachten bij Kasteel Kerckebosch. Wil je daar ook blijven slapen? Reserveer dan zelf even een kamer. De volgende ochtend ontbijten we daar. Gasten die er overnachten kunnen gezellig aanschuiven.",
  link: { href: "https://www.kasteelkerckebosch.com", label: "kasteelkerckebosch.com" },
  opties: [
    { naam: "Stayokay Bunnik", type: "hotel", url: "https://www.google.com/maps/search/?api=1&query=Stayokay+Utrecht-Bunnik" },
    { naam: "Van der Valk Houten", type: "hotel", url: "https://www.google.com/maps/search/?api=1&query=Van+der+Valk+Hotel+Houten" },
    { naam: "Hotel Mitland", type: "hotel", url: "https://www.google.com/maps/search/?api=1&query=Hotel+Mitland+Utrecht" },
    { naam: "Postillion Hotel Bunnik", type: "hotel", url: "https://www.google.com/maps/search/?api=1&query=Postillion+Hotel+Utrecht+Bunnik" },
    { naam: "Camping De Boomgaard", type: "camping", url: "https://www.google.com/maps/search/?api=1&query=Camping+De+Boomgaard+Bunnik" },
    { naam: "Camping De Vliert", type: "camping", url: "https://www.google.com/maps/search/?api=1&query=Camping+De+Vliert+Bunnik" },
  ],
}

export default function InfoPage() {
  // Avondgasten zien hun eigen programma; zolang het dagdeel onbekend is
  // tonen we het volledige programma met de avondgasten-notitie.
  const [dagdeel, setDagdeel] = useState<"dag" | "avond" | null>(null)

  useEffect(() => {
    getMijnDagdeel().then(setDagdeel)
  }, [])

  const programma = dagdeel === "avond" ? PROGRAMMA_AVOND : PROGRAMMA

  return (
    <main className="min-h-screen pb-24">
      <div className="absolute top-4 right-4 z-10">
        <LogoutButton />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <header className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Info className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Aanvullende informatie
          </h1>
          <p className="font-medium text-primary">{TROUWDATUM_TEKST}</p>
          <p className="text-muted-foreground">
            Alles wat je moet weten over de grote dag
          </p>
        </header>

        {/* Programma & tijden */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Clock className="w-5 h-5 text-primary" /> Programma
            </CardTitle>
            <CardDescription>
              {dagdeel === "avond" ? "Zo ziet jullie avond eruit" : "Zo ziet de dag eruit"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {programma.map((item) => {
                const Icon = PROGRAMMA_ICONS[item.titel] ?? Clock
                return (
                  <li key={item.tijd} className="flex items-center gap-3">
                    <p className="w-[72px] shrink-0 text-right text-sm font-semibold text-primary">
                      {item.tijd} uur
                    </p>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{item.titel}</p>
                      <p className="text-sm text-muted-foreground">{item.omschrijving}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
            {dagdeel === null && (
              <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted p-3">
                <PartyPopper className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">{AVONDGASTEN}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Locatie & parkeren */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <MapPin className="w-5 h-5 text-primary" /> Locatie
            </CardTitle>
            <CardDescription>{LOCATIE.naam}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-foreground">{LOCATIE.adres}</p>
            <a
              href={LOCATIE.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <MapPin className="w-4 h-4" /> Open in Google Maps
            </a>
            <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
              <Car className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{LOCATIE.parkeren}</p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
              <TrainFront className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{LOCATIE.ov}</p>
            </div>
          </CardContent>
        </Card>

        {/* Dresscode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Shirt className="w-5 h-5 text-primary" /> Dresscode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-serif text-2xl font-bold text-center text-foreground">
              {DRESSCODE.code}
            </p>
            <p className="text-sm text-muted-foreground text-center">{DRESSCODE.toelichting}</p>
            {/* Grote cirkels overlappen richting het midden (middelste bovenop),
                kleintjes sluiten aan en verschuilen zich half achter de grote rij */}
            <div className="pb-4">
              <div className="relative z-10 flex justify-center">
                {DRESSCODE.kleuren.map((kleur, i) => (
                  <span
                    key={kleur}
                    className="relative w-[88px] h-[88px] rounded-full border-2 border-card shrink-0"
                    style={{
                      backgroundColor: kleur,
                      marginLeft: i > 0 ? -42 : 0,
                      zIndex: 30 - Math.abs(i - 2) * 10,
                    }}
                  />
                ))}
              </div>
              {/* Onderste rij: middelste onderop, naar buiten toe telkens een laag erboven */}
              <div className="relative z-0 -mt-4 flex justify-center">
                {DRESSCODE.kleurenKlein.map((kleur, i) => (
                  <span
                    key={kleur}
                    className="relative w-11 h-11 rounded-full shrink-0"
                    style={{
                      backgroundColor: kleur,
                      marginLeft: i > 0 ? -9 : 0,
                      zIndex: 1 + Math.abs(i - 2),
                    }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cadeautip */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Gift className="w-5 h-5 text-primary" /> Cadeautip
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{CADEAUTIP.intro}</p>
            <p className="text-sm text-muted-foreground">{CADEAUTIP.intro2}</p>
            <ul className="space-y-2">
              {CADEAUTIP.belevenissen.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.tekst} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{item.tekst}</span>
                  </li>
                )
              })}
            </ul>
            <p className="text-sm text-muted-foreground">{CADEAUTIP.outro}</p>
          </CardContent>
        </Card>

        {/* Contact & praktisch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Phone className="w-5 h-5 text-primary" /> Contact & praktisch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {PRAKTISCH.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.titel} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{item.titel}</p>
                    <p className="text-sm text-muted-foreground">{item.tekst}</p>
                    <div className="mt-2 space-y-2">
                      {item.contacten.map((c) => (
                        <a
                          key={c.telefoon}
                          href={`tel:${c.telefoon.replace(/[-\s]/g, "")}`}
                          className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                        >
                          <span className="font-medium text-foreground">{c.naam}</span>
                          <span className="text-sm text-primary">{c.telefoon}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Overnachten */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <BedDouble className="w-5 h-5 text-primary" /> Overnachten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{OVERNACHTEN.tekst}</p>
            <a
              href={OVERNACHTEN.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              {OVERNACHTEN.link.label} →
            </a>
            <p className="text-sm font-medium text-foreground">Andere plekken in de buurt:</p>
            <div className="space-y-2">
              {OVERNACHTEN.opties.map((optie) => {
                const OptieIcon = optie.type === "camping" ? Tent : Hotel
                return (
                  <a
                    key={optie.naam}
                    href={optie.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <OptieIcon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{optie.naam}</span>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Navigation />
    </main>
  )
}
