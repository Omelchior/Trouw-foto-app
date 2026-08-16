// Uploadpiek nabootsen: schrijft N testfoto's (SVG) naar de loadtest/-prefix in
// storage én een photos-rij met een challenge_id, zodat ze in de diavoorstelling
// verschijnen en de realtime-stroom op gang komt.
//
//   node scripts/loadtest/burst.mjs --count=40 --concurrency=20 --delay=0
//
// --count       aantal foto's (standaard 40)
// --concurrency hoeveel tegelijk (standaard 20)
// --delay       ms tussen het starten van elke upload (standaard 0 = alles ineens)
//
// Ruim op met: node scripts/loadtest/cleanup.mjs
import { makeClient, loginAsGuest, testSvg, LOADTEST_TAG, LOADTEST_PREFIX, argInt } from './_lib.mjs'

const COUNT = argInt('count', 40)
const CONCURRENCY = argInt('concurrency', 20)
const DELAY = argInt('delay', 0)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function uploadOne(supabase, userId, n) {
  const path = `${LOADTEST_PREFIX}${Date.now()}-${n}-${Math.random().toString(36).slice(2, 8)}.svg`
  const body = new Blob([testSvg(n)], { type: 'image/svg+xml' })

  const up = await supabase.storage.from('wedding-photos').upload(path, body, {
    contentType: 'image/svg+xml',
  })
  if (up.error) throw new Error(`storage ${n}: ${up.error.message}`)

  const ins = await supabase.from('photos').insert({
    storage_path: path,
    uploaded_by: LOADTEST_TAG,
    user_id: userId,
    challenge_id: (n % 33) + 1, // zorgt dat de foto in de show hoort
    in_fotoboek: false,
  })
  if (ins.error) throw new Error(`insert ${n}: ${ins.error.message}`)
}

async function main() {
  const supabase = makeClient()
  console.log('Inloggen als olaf (admin) zodat opruimen later lukt…')
  const user = await loginAsGuest(supabase, 'olaf')

  console.log(`Piek: ${COUNT} foto's, ${CONCURRENCY} tegelijk, ${DELAY}ms tussenpauze.`)
  const t0 = Date.now()
  let done = 0
  let failed = 0

  let next = 0
  async function worker() {
    while (next < COUNT) {
      const n = next++
      if (DELAY) await sleep(DELAY)
      try {
        await uploadOne(supabase, user.id, n + 1)
        done++
      } catch (e) {
        failed++
        console.error('  ✗', e.message)
      }
      if ((done + failed) % 10 === 0) {
        console.log(`  …${done + failed}/${COUNT} (${done} ok, ${failed} fout)`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`Klaar: ${done} geüpload, ${failed} mislukt in ${secs}s ` +
    `(${(done / (secs || 1)).toFixed(1)} foto's/s).`)
  console.log('Opruimen: node scripts/loadtest/cleanup.mjs')
}

main().catch((e) => { console.error(e); process.exit(1) })
