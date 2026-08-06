import { db } from '../src/db/database'
import { importEinburgertestDeck } from '../src/services/einburgertestImport'

async function main(): Promise<void> {
  const { deckId, upserted } = await importEinburgertestDeck()
  console.log(`Imported deck "einbuergerungstest" (id ${deckId}) with ${upserted} questions.`)
  await db.end()
}

main().catch((error) => {
  console.error('Import failed:', error)
  process.exit(1)
})
