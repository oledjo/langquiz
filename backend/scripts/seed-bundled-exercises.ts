import { db } from '../src/db/database'
import { seedBundledExercises } from '../src/services/seedBundledExercises'

async function main(): Promise<void> {
  const { deckId, upserted } = await seedBundledExercises()
  console.log(`Seeded deck "german-grammar-vocabulary" (id ${deckId}) with ${upserted} questions.`)
  await db.end()
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
