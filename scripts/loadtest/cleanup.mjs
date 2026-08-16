// Verwijdert alle load-testfoto's weer: de photos-rijen met tag LOADTEST én de
// bijbehorende storage-bestanden onder de loadtest/-prefix. Logt in als olaf
// (admin) omdat verwijderen admin-rechten vereist (RLS, migratie 014).
//
//   node scripts/loadtest/cleanup.mjs
import { makeClient, loginAsGuest, LOADTEST_TAG, LOADTEST_PREFIX } from './_lib.mjs'

async function main() {
  const supabase = makeClient()
  console.log('Inloggen als olaf (admin)…')
  await loginAsGuest(supabase, 'olaf')

  // 1. Rijen ophalen (storage_path nodig voor het wissen van de bestanden).
  const { data: rows, error } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('uploaded_by', LOADTEST_TAG)
  if (error) throw error

  if (!rows || rows.length === 0) {
    console.log('Geen load-testfoto\'s gevonden. Niets te doen.')
    return
  }
  console.log(`Gevonden: ${rows.length} testfoto's.`)

  // 2. Storage-bestanden wissen (in blokken; alleen loadtest/-paden).
  const paths = rows.map((r) => r.storage_path).filter((p) => p.startsWith(LOADTEST_PREFIX))
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100)
    const { error: rmErr } = await supabase.storage.from('wedding-photos').remove(chunk)
    if (rmErr) console.error('  storage-fout:', rmErr.message)
  }
  console.log(`Storage: ${paths.length} bestanden verwijderd.`)

  // 3. Database-rijen wissen.
  const { error: delErr } = await supabase.from('photos').delete().eq('uploaded_by', LOADTEST_TAG)
  if (delErr) throw delErr
  console.log(`Database: ${rows.length} rijen verwijderd. Opgeruimd.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
