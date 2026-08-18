import { Fragment, type ReactNode } from "react"

/**
 * Leesweergave voor het draaiboek. De tekst wordt bewaard als platte tekst met
 * een kleine Markdown-subset (#/##/### koppen, - en 1. lijsten, **vet**,
 * *cursief* en `code`); hier zetten we die om in leesbare blokken.
 *
 * Elke `##`-sectie wordt een inklapbaar blok, zodat het draaiboek op een
 * telefoon als inhoudsopgave te gebruiken is.
 */

type Blok =
  | { soort: "kop3"; tekst: string }
  | { soort: "alinea"; regels: string[] }
  | { soort: "lijst"; genummerd: boolean; items: string[] }

type Sectie = { titel: string | null; blokken: Blok[] }

/** Zet **vet**, *cursief* en `code` om in React-elementen. */
function inline(tekst: string): ReactNode {
  const delen = tekst.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return delen.map((deel, i) => {
    if (deel.startsWith("**") && deel.endsWith("**") && deel.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {deel.slice(2, -2)}
        </strong>
      )
    }
    if (deel.startsWith("*") && deel.endsWith("*") && deel.length > 2) {
      return <em key={i}>{deel.slice(1, -1)}</em>
    }
    if (deel.startsWith("`") && deel.endsWith("`") && deel.length > 2) {
      return (
        <code key={i} className="font-mono text-[0.9em] bg-muted px-1 py-0.5 rounded">
          {deel.slice(1, -1)}
        </code>
      )
    }
    return <Fragment key={i}>{deel}</Fragment>
  })
}

/** Splitst de ruwe tekst in secties (per ##) met daarin blokken. */
function ontleed(tekst: string): { titel: string | null; intro: Blok[]; secties: Sectie[] } {
  const secties: Sectie[] = []
  let titel: string | null = null
  let huidig: Sectie = { titel: null, blokken: [] }
  // Een lege regel sluit het lopende blok af; de volgende regel begint opnieuw.
  let afgesloten = true

  const voegToe = (blok: Blok) => {
    huidig.blokken.push(blok)
    afgesloten = false
  }

  for (const ruwe of tekst.split("\n")) {
    const regel = ruwe.trimEnd()
    const laatste = afgesloten ? undefined : huidig.blokken[huidig.blokken.length - 1]

    if (regel.trim() === "") {
      afgesloten = true
      continue
    }
    if (regel.startsWith("# ")) {
      titel = regel.slice(2).trim()
      afgesloten = true
      continue
    }
    if (regel.startsWith("## ")) {
      secties.push(huidig)
      huidig = { titel: regel.slice(3).trim(), blokken: [] }
      afgesloten = true
      continue
    }
    if (regel.startsWith("### ")) {
      voegToe({ soort: "kop3", tekst: regel.slice(4).trim() })
      afgesloten = true
      continue
    }

    const opsomming = /^[-*]\s+(.*)$/.exec(regel)
    const genummerd = /^\d+[.)]\s+(.*)$/.exec(regel)
    if (opsomming || genummerd) {
      const item = (opsomming ?? genummerd)![1]
      const isGenummerd = Boolean(genummerd)
      if (laatste?.soort === "lijst" && laatste.genummerd === isGenummerd) laatste.items.push(item)
      else voegToe({ soort: "lijst", genummerd: isGenummerd, items: [item] })
      continue
    }

    if (laatste?.soort === "alinea") laatste.regels.push(regel)
    else voegToe({ soort: "alinea", regels: [regel] })
  }
  secties.push(huidig)

  const [eerste, ...rest] = secties
  return { titel, intro: eerste?.blokken ?? [], secties: rest.filter((s) => s.titel !== null) }
}

function Blokken({ blokken }: { blokken: Blok[] }) {
  return (
    <>
      {blokken.map((blok, i) => {
        if (blok.soort === "kop3") {
          return (
            <h3 key={i} className="font-serif font-bold text-base mt-5 first:mt-0 text-primary">
              {inline(blok.tekst)}
            </h3>
          )
        }
        if (blok.soort === "lijst") {
          const Lijst = blok.genummerd ? "ol" : "ul"
          return (
            <Lijst
              key={i}
              className={
                blok.genummerd
                  ? "list-decimal pl-5 my-2 space-y-1 marker:text-muted-foreground"
                  : "list-disc pl-5 my-2 space-y-1 marker:text-muted-foreground"
              }
            >
              {blok.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </Lijst>
          )
        }
        return (
          <p key={i} className="my-2 leading-relaxed">
            {blok.regels.map((regel, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(regel)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </>
  )
}

export function DraaiboekTekst({ tekst }: { tekst: string }) {
  const { titel, intro, secties } = ontleed(tekst)

  if (!tekst.trim()) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nog geen draaiboek ingevuld. Klik op &ldquo;Bewerken&rdquo; om te beginnen.
      </p>
    )
  }

  return (
    <article className="text-sm text-foreground/90">
      {titel && <h2 className="font-serif text-2xl font-bold mb-3">{titel}</h2>}
      {intro.length > 0 && (
        <div className="mb-4">
          <Blokken blokken={intro} />
        </div>
      )}

      <div className="space-y-2">
        {secties.map((sectie, i) => (
          <details key={i} className="group rounded-xl border border-border bg-card overflow-hidden">
            <summary className="cursor-pointer list-none select-none px-4 py-3 font-serif font-bold text-base flex items-center justify-between gap-2 hover:bg-muted/60">
              <span>{sectie.titel}</span>
              <span className="text-muted-foreground text-xs shrink-0 transition-transform group-open:rotate-90" aria-hidden>
                ▶
              </span>
            </summary>
            <div className="px-4 pb-4 pt-1 border-t border-border">
              <Blokken blokken={sectie.blokken} />
            </div>
          </details>
        ))}
      </div>
    </article>
  )
}
