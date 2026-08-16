// Lees of zet de app-open-modus, voor het testen van de schakelaar.
//   node scripts/loadtest/mode.mjs            -> print huidige modus (publieke read)
//   node scripts/loadtest/mode.mjs open       -> log in als olaf (admin) en zet 'open'
import { makeClient, loginAsGuest } from './_lib.mjs'

const wens = process.argv[2]

async function main() {
  const supabase = makeClient()
  if (wens) {
    if (!['auto', 'open', 'dicht'].includes(wens)) throw new Error(`onbekende modus: ${wens}`)
    await loginAsGuest(supabase, 'olaf')
    const { data, error } = await supabase
      .from('app_status')
      .update({ open_modus: wens, bijgewerkt_op: new Date().toISOString() })
      .eq('id', 1)
      .select('open_modus')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('geen rijen bijgewerkt (RLS?)')
    console.log('gezet op:', data[0].open_modus)
  } else {
    const { data, error } = await supabase.from('app_status').select('open_modus').eq('id', 1).maybeSingle()
    if (error) throw error
    console.log('huidige modus:', data?.open_modus ?? '(geen rij)')
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
