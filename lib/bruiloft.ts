// Gedeelde trouwdag-gegevens en -logica (pure TS: ook bruikbaar in de
// edge-middleware, dus geen React/iconen hier).

export const TROUWDATUM_TEKST = "Vrijdag 21 augustus 2026"

/** 21 augustus 2026, 00:00 Nederlandse tijd (CEST = UTC+2). */
export const TROUWDAG_START_MS = Date.UTC(2026, 7, 20, 22, 0, 0)

/** Vanaf de trouwdag mogen gasten alles in de app; daarvoor alleen de info. */
export function isAppOpen(): boolean {
  return Date.now() >= TROUWDAG_START_MS
}

/** Gastenpagina's die pas op de trouwdag opengaan (beheer mag altijd). */
export const GESLOTEN_VOOR_TROUWDAG = [
  "/bingo",
  "/selectie",
  "/gastenboek",
  "/diavoorstelling",
]

export interface Programmapunt {
  tijd: string
  titel: string
  omschrijving: string
  /** Uren na middernacht (NL-tijd) op de trouwdag; 24.5 = 00:30 de nacht erna. */
  uren: number
}

export const PROGRAMMA: Programmapunt[] = [
  { tijd: "14:00", titel: "Aanvang", omschrijving: "Ontvangst op Mereveld", uren: 14 },
  { tijd: "14:30", titel: "Ceremonie", omschrijving: "Het ja-woord", uren: 14.5 },
  { tijd: "15:30", titel: "Taart", omschrijving: "Tijd voor iets zoets", uren: 15.5 },
  { tijd: "16:00", titel: "Borrel", omschrijving: "Proosten op het bruidspaar", uren: 16 },
  { tijd: "17:30", titel: "Diner", omschrijving: "Aan tafel", uren: 17.5 },
  { tijd: "20:30", titel: "Feest", omschrijving: "Met de voeten van de vloer", uren: 20.5 },
  { tijd: "00:30", titel: "Einde", omschrijving: "Wel thuis!", uren: 24.5 },
]

/** Het programma zoals avondgasten het zien. */
export const PROGRAMMA_AVOND: Programmapunt[] = [
  { tijd: "20:00", titel: "Aanvang", omschrijving: "Ontvangst op Mereveld", uren: 20 },
  { tijd: "20:30", titel: "Feest", omschrijving: "Met een drankje in de hand, met de voeten van de vloer", uren: 20.5 },
  { tijd: "00:30", titel: "Einde", omschrijving: "Wel thuis!", uren: 24.5 },
]

/** "Nog X dagen", "Vandaag is het zover!" of null (na de bruiloft). */
export function countdownTekst(): string | null {
  const trouwdag = new Date(2026, 7, 21)
  const vandaag = new Date()
  vandaag.setHours(0, 0, 0, 0)
  const dagen = Math.round((trouwdag.getTime() - vandaag.getTime()) / 86_400_000)
  if (dagen > 1) return `Nog ${dagen} dagen`
  if (dagen === 1) return "Nog 1 dag!"
  if (dagen === 0) return "Vandaag is het zover! 🎉"
  return null
}

/** Het eerstvolgende programmapunt op de trouwdag zelf, anders null. */
export function volgendProgrammapunt(): Programmapunt | null {
  const nu = Date.now()
  if (nu < TROUWDAG_START_MS) return null
  return (
    PROGRAMMA.find((p) => TROUWDAG_START_MS + p.uren * 3_600_000 >= nu) ?? null
  )
}
