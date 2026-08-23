import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { db, checksumOf } from './database'
import { importEinburgertestDeck } from '../services/einburgertestImport'
import { mapEinburgertestQuestion, type EinburgertestQuestion } from '../services/mapEinburgertestQuestion'
import { seedBundledExercises } from '../services/seedBundledExercises'
import { imagesDir, manifestPath, readQuestionImageManifest, seedQuestionImages } from '../services/seedQuestionImages'

/**
 * Content that ships with the repository, loaded into Postgres on boot.
 *
 * Schema migrations answer "what shape is the database"; these answer "what is in it". They are
 * kept apart because they fail differently: a bad migration must stop the deploy, whereas stale
 * questions are much better than a backend that will not start.
 *
 * A seed re-runs when its **output** changes, not when its input file does. Hashing the mapped
 * result is what makes editing `mapEinburgertestQuestion.ts` — a code change, with no data file
 * touched — count as a content change. Before this existed, a mapper edit reached production only
 * if somebody remembered to run `npm run import:einburgertest` by hand, which is exactly the
 * failure this module removes.
 */
export interface ContentSeed {
  name: string
  /** Stable hash of what this seed would write. Equal hash means the run is skipped. */
  checksum(): string
  /** Performs the seed; the returned string is logged as a one-line summary. */
  run(): Promise<string>
}

/**
 * What one seed did. Returned rather than thrown so a boot can ignore failures while a CI run or
 * an operator running scripts/converge.ts can treat them as fatal.
 */
export interface ContentSeedResult {
  name: string
  status: 'applied' | 'skipped' | 'failed'
  summary?: string
  error?: unknown
}

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

export const CONTENT_SEEDS: ContentSeed[] = [
  {
    name: 'bundled-exercises',
    checksum: () => hashFile(path.resolve(__dirname, '../../data/bundled-exercises.json')),
    run: async () => {
      const { upserted } = await seedBundledExercises()
      return `${upserted} exercises`
    },
  },
  {
    name: 'einburgertest',
    checksum: () => {
      const dataPath = path.resolve(__dirname, '../../data/einburgertest-demo-catalog.json')
      const questions: EinburgertestQuestion[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
      // The mapped payloads, not the raw catalog: this is what actually lands in `exercises.data`,
      // so a mapper change moves the hash even though no file on disk changed.
      return checksumOf(JSON.stringify(questions.map(mapEinburgertestQuestion)))
    },
    run: async () => {
      const { upserted } = await importEinburgertestDeck()
      return `${upserted} questions`
    },
  },
  {
    name: 'einburgertest-images',
    checksum: () => {
      const entries = readQuestionImageManifest()
      const dir = imagesDir()
      const parts = entries.map((entry) => {
        const filePath = path.join(dir, entry.file)
        const bytes = fs.existsSync(filePath) ? hashFile(filePath) : 'missing'
        return `${entry.exerciseId}#${entry.slot}:${entry.contentType}:${bytes}:${checksumOf(entry.alt)}:${entry.attribution ?? ''}`
      })
      return checksumOf([hashFile(manifestPath()), ...parts].join('\n'))
    },
    run: async () => {
      const { upserted, removed, skipped } = await seedQuestionImages()
      return `${upserted} uploaded, ${removed} removed, ${skipped} left to admin uploads`
    },
  },
]

/**
 * Brings stored content in line with the repository.
 *
 * Called after the HTTP server is already listening. Every seed is attempted even if an earlier
 * one throws, and failures are logged rather than rethrown — a content problem should show up as
 * an out-of-date question, not as a service outage. Set `SKIP_CONTENT_SEED=true` to opt out
 * entirely, which is what a one-off script or a local database restore wants.
 */
export async function runContentSeeds(seeds: ContentSeed[] = CONTENT_SEEDS): Promise<ContentSeedResult[]> {
  if (process.env.SKIP_CONTENT_SEED === 'true') {
    console.log('Content seeding skipped (SKIP_CONTENT_SEED=true).')
    return []
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS content_seeds (
      name       TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const results: ContentSeedResult[] = []

  for (const seed of seeds) {
    try {
      const checksum = seed.checksum()
      const stored = await db.query<{ checksum: string }>(
        'SELECT checksum FROM content_seeds WHERE name = $1',
        [seed.name]
      )
      if (stored.rows[0]?.checksum === checksum) {
        results.push({ name: seed.name, status: 'skipped' })
        continue
      }

      const summary = await seed.run()
      // Recorded only on success, so a failed seed is retried on the next boot.
      await db.query(
        `INSERT INTO content_seeds (name, checksum) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
        [seed.name, checksum]
      )
      console.log(`Content seed "${seed.name}" applied: ${summary}`)
      results.push({ name: seed.name, status: 'applied', summary })
    } catch (error) {
      console.error(`Content seed "${seed.name}" failed:`, error)
      results.push({ name: seed.name, status: 'failed', error })
    }
  }

  return results
}
