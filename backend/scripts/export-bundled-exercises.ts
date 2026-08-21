/**
 * Development-time content sync: reads the exercise packs authored in `frontend/src/exercises/`
 * and writes them into `backend/data/bundled-exercises.json`, which is committed and read by
 * `seed-bundled-exercises.ts` to load the questions into Postgres.
 *
 * Why a vendored snapshot instead of the seed script importing the frontend directly: the seed
 * script runs wherever DATABASE_URL points (a deploy shell, a container with only `backend/`
 * installed), and reaching across into another package's TypeScript sources from there is
 * exactly the kind of environment-dependent read that the Einbürgerungstest import avoided for
 * the same reason. This script is the only thing that touches `frontend/`, and it runs from a
 * full checkout by a human, after content changes.
 *
 * Usage: npm run export:exercises  (then commit the regenerated JSON)
 */
import fs from 'fs/promises'
import path from 'path'

const EXERCISES_DIR = path.resolve(__dirname, '../../frontend/src/exercises')
const OUTPUT_FILE = path.resolve(__dirname, '../data/bundled-exercises.json')

interface BundledExercise {
  id: string
  [key: string]: unknown
}

async function loadPack(file: string): Promise<BundledExercise[]> {
  const module = (await import(path.join(EXERCISES_DIR, file))) as { default?: unknown }
  const exercises = module.default

  if (!Array.isArray(exercises)) {
    throw new Error(`${file} does not default-export an array of exercises.`)
  }

  return exercises.map((exercise, index) => {
    if (!exercise || typeof exercise !== 'object') {
      throw new Error(`${file} exercise #${index + 1} is not an object.`)
    }
    const id = (exercise as { id?: unknown }).id
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error(`${file} exercise #${index + 1} has no usable "id".`)
    }
    return exercise as BundledExercise
  })
}

async function main(): Promise<void> {
  const files = (await fs.readdir(EXERCISES_DIR)).filter((file) => file.endsWith('.ts')).sort()
  const byId = new Map<string, BundledExercise>()

  for (const file of files) {
    for (const exercise of await loadPack(file)) {
      const existing = byId.get(exercise.id)
      if (existing) {
        throw new Error(`Duplicate exercise id "${exercise.id}" (second definition in ${file}).`)
      }
      byId.set(exercise.id, exercise)
    }
  }

  // Sorted by id so regenerating the file produces a reviewable diff rather than a reshuffle.
  const exercises = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(exercises, null, 2)}\n`, 'utf8')

  console.log(`Exported ${exercises.length} exercises from ${files.length} packs to ${OUTPUT_FILE}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
