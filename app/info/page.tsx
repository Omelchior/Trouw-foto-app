"use client"

import { Info, Clock, MapPin, Shirt, Gift, Phone, BedDouble, UtensilsCrossed, Car, PartyPopper, TrainFront, Bird, Luggage, Wine, Sparkles, Ticket } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { AdminAccessButton } from "@/components/admin-access-button"
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
const DATUM = "Vrijdag 21 augustus 2026"

const PROGRAMMA = [
  { tijd: "14:00", titel: "Aanvang", omschrijving: "Ontvangst op Mereveld" },
  { tijd: "14:30", titel: "Ceremonie", omschrijving: "Het ja-woord" },
  { tijd: "15:30", titel: "Taart", omschrijving: "Tijd voor iets zoets" },
  { tijd: "16:00", titel: "Borrel", omschrijving: "Proosten op het bruidspaar" },
  { tijd: "17:30", titel: "Diner", omschrijving: "Aan tafel" },
  { tijd: "20:30", titel: "Feest", omschrijving: "Met de voeten van de vloer" },
  { tijd: "00:30", titel: "Einde", omschrijving: "Wel thuis!" },
]

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
    "Jullie aanwezigheid is het mooiste cadeau. Willen jullie ons toch verwennen? Wij sparen liever herinneringen dan spullen. Met een bijdrage aan één van deze belevenissen maken jullie ons heel blij:",
  belevenissen: [
    { icon: Bird, tekst: "Vogelexcursie of natuurwandeling met gids" },
    { icon: Luggage, tekst: "Weekendje weg in Nederland" },
    { icon: UtensilsCrossed, tekst: "Dinerbon voor een mooi restaurant" },
    { icon: Wine, tekst: "Wijnproeverij of speciaalbierproeverij" },
    { icon: Sparkles, tekst: "Sauna- of wellnessdag" },
    { icon: Ticket, tekst: "Tickets voor een voorstelling" },
  ],
  outro:
    "Daarnaast sparen we ook voor een mooie serviesset. Er staat een enveloppendoos bij de ingang.",
}

const CONTACT = {
  ceremoniemeesters: [
    { naam: "Anton Melchior", telefoon: "06-420 605 57" },
    { naam: "Sira de Waard", telefoon: "06-294 289 07" },
  ],
  toelichting: "Vragen op de dag zelf? Bel of app de ceremoniemeesters.",
}

const PRAKTISCH = [
  {
    icon: UtensilsCrossed,
    titel: "Allergieën & dieetwensen",
    tekst: "Laat dieetwensen of allergieën vóór 31 juli even weten via 06-250 600 54 of 06-316 428 88.",
    link: null,
  },
  {
    icon: BedDouble,
    titel: "Overnachten",
    tekst: "Wij overnachten bij Kasteel Kerckebosch. Wil je daar ook blijven slapen? Reserveer dan zelf even een kamer. De volgende ochtend ontbijten we daar. Gasten die er overnachten kunnen gezellig aanschuiven.",
    link: { href: "https://www.kasteelkerckebosch.com", label: "kasteelkerckebosch.com" },
  },
]

export default function InfoPage() {
  return (
    <main className="min-h-screen pb-24">
      <div className="absolute top-4 right-4 z-10">
        <AdminAccessButton />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <header className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Info className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Aanvullende informatie
          </h1>
          <p className="font-medium text-primary">{DATUM}</p>
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
            <CardDescription>Zo ziet de dag eruit</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-border ml-3 space-y-5">
              {PROGRAMMA.map((item) => (
                <li key={item.tijd} className="ml-5">
                  <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-semibold text-primary">{item.tijd}</p>
                  <p className="font-medium text-foreground">{item.titel}</p>
                  <p className="text-sm text-muted-foreground">{item.omschrijving}</p>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted p-3">
              <PartyPopper className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{AVONDGASTEN}</p>
            </div>
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
              <div className="relative z-10 flex justify-center items-end -space-x-4">
                {DRESSCODE.kleuren.map((kleur, i) => {
                  const maat = [56, 62, 68, 62, 56][i]
                  return (
                    <span
                      key={kleur}
                      className="relative rounded-full border-2 border-card shrink-0"
                      style={{
                        backgroundColor: kleur,
                        width: maat,
                        height: maat,
                        zIndex: 30 - Math.abs(i - 2) * 10,
                      }}
                    />
                  )
                })}
              </div>
              <div className="relative z-0 -mt-4 flex justify-center translate-x-[10px]">
                {DRESSCODE.kleurenKlein.map((kleur) => (
                  <span
                    key={kleur}
                    className="w-9 h-9 rounded-full shrink-0"
                    style={{ backgroundColor: kleur }}
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
            <CardDescription>{CONTACT.toelichting}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {CONTACT.ceremoniemeesters.map((cm) => (
                <a
                  key={cm.telefoon}
                  href={`tel:${cm.telefoon.replace(/[-\s]/g, "")}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                >
                  <span className="font-medium text-foreground">{cm.naam}</span>
                  <span className="text-sm text-primary">{cm.telefoon}</span>
                </a>
              ))}
            </div>

            {PRAKTISCH.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.titel} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.titel}</p>
                    <p className="text-sm text-muted-foreground">{item.tekst}</p>
                    {item.link && (
                      <a
                        href={item.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {item.link.label} →
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Navigation />
    </main>
  )
}
