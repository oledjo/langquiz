import { db, runMigrations } from '../src/db/database'
import { runContentSeeds } from '../src/db/contentSeeds'

/**
 * Runs everything a boot would run against the database — migrations, then content seeds — and
 * exits. The backend does this on startup on its own, so this script exists for the two cases
 * where there is no boot to piggyback on:
 *
 * - CI, which points it at a throwaway Postgres to prove an empty database converges cleanly.
 * - An operator converging a database by hand (a restore, a new environment, a local dev setup).
 *
 * Unlike a boot, a failed content seed is fatal here. A running service is better off with stale
 * questions than with no service, but a CI run that quietly passed on a broken seed would defeat
 * the point of having the job.
 */
async function main(): Promise<void> {
  await runMigrations()
  const results = await runContentSeeds()

  for (const result of results) {
    if (result.status === 'skipped') console.log(`Content seed "${result.name}" already up to date.`)
  }

  const failed = results.filter((result) => result.status === 'failed')
  await db.end()

  if (failed.length > 0) {
    throw new Error(`Content seeds failed: ${failed.map((result) => result.name).join(', ')}`)
  }
  console.log('Database is up to date.')
}

main().catch((error) => {
  console.error('Converge failed:', error)
  process.exit(1)
})
