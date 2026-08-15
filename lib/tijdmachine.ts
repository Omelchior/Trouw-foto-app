// Hulpje om de trouwdag lokaal te bekijken zonder de datum in de code aan te
// passen. Werkt alleen in `next dev`; in productie doet deze functie niets.
//
//   /?nu=2026-08-21T20:29          -> alsof het 20:29 op de trouwdag is
//   /?nu=2026-08-21T20:29&snel=10  -> idem, maar de tijd loopt 10x zo snel,
//                                     zodat je de countdown ziet aflopen
//
// Een gewone refresh zonder ?nu= zet alles terug op de echte tijd.

export function startTijdmachine(): void {
  if (process.env.NODE_ENV === "production") return
  if (typeof window === "undefined") return

  const params = new URLSearchParams(window.location.search)
  const nu = params.get("nu")
  if (!nu) return

  // Zonder tijdzone leest de browser dit als lokale (Nederlandse) tijd.
  const doel = new Date(nu).getTime()
  if (Number.isNaN(doel)) {
    console.warn(`[tijdmachine] onleesbare tijd: ${nu}`)
    return
  }

  const snel = Math.max(1, Number(params.get("snel")) || 1)
  const echteNu = Date.now.bind(Date)
  const start = echteNu()
  Date.now = () => doel + (echteNu() - start) * snel

  console.info(
    `[tijdmachine] klok staat op ${new Date(doel).toLocaleString("nl-NL")}` +
      (snel > 1 ? ` en loopt ${snel}x zo snel` : ""),
  )
}
