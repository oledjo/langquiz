import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'

function resolveMigrationsDir(): string {
  const distDir = path.resolve(__dirname, 'migrations')
  if (fs.existsSync(distDir)) return distDir

  // Render/production often compiles TS to dist without copying .sql files.
  // In that case we read migrations directly from src.
  const srcDir = path.resolve(__dirname, '../../src/db/migrations')
  if (fs.existsSync(srcDir)) return srcDir

  throw new Error(
    `Could not find migrations directory. Tried: ${distDir} and ${srcDir}`
  )
}

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required (Supabase Postgres connection string).')
}

export const db = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.PGSSLMODE === 'disable'
      ? false
      : {
          rejectUnauthorized: false,
        },
})

/**
 * Arbitrary but fixed: every instance of this app has to pick the same number for the lock to
 * mean anything. Changing it would let an old and a new instance migrate concurrently.
 */
const MIGRATION_LOCK_ID = 4_128_837_501

export function checksumOf(sql: string): string {
  return crypto.createHash('sha256').update(sql, 'utf-8').digest('hex')
}

/** The subset of a pg client this module needs — narrow enough for a test double to satisfy. */
export interface MigrationClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: R[]; rowCount: number | null }>
}

/**
 * Applies every not-yet-applied `.sql` file in `migrationsDir`, in filename order, each in its own
 * transaction. Forward-only: there are no `down` migrations, and a file that has been applied is
 * never re-run.
 *
 * Two integrity checks make "migrations run themselves on every boot" safe to rely on:
 *
 * - **A changed file throws.** Editing an already-applied migration is silently a no-op against
 *   any database that already ran it, so the file and the schema drift apart with nothing to
 *   notice. The recorded checksum turns that into a failed boot, which on Render means a failed
 *   deploy with the previous instance still serving. Fix forward with a new file.
 * - **An applied row with no file only warns.** Deleting a migration is legitimate history — see
 *   014_user_review_settings.sql, added and later removed — and must not wedge every future boot.
 *
 * Rows recorded before checksums existed have `checksum IS NULL`; their file's checksum is adopted
 * on the next boot rather than treated as a mismatch.
 */
export async function applyMigrations(client: MigrationClient, migrationsDir: string): Promise<void> {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT')

  const appliedResult = await client.query<{ name: string; checksum: string | null }>(
    'SELECT name, checksum FROM schema_migrations'
  )
  const applied = new Map(appliedResult.rows.map((row) => [row.name, row.checksum]))

  for (const name of applied.keys()) {
    if (!files.includes(name)) {
      console.warn(
        `Migration ${name} is recorded as applied but no longer exists in the repository. ` +
          'Leaving the record in place.'
      )
    }
  }

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    const checksum = checksumOf(sql)

    if (applied.has(file)) {
      const recorded = applied.get(file) ?? null
      if (recorded === null) {
        await client.query('UPDATE schema_migrations SET checksum = $2 WHERE name = $1', [file, checksum])
        continue
      }
      if (recorded !== checksum) {
        throw new Error(
          `Migration ${file} has changed since it was applied (recorded ${recorded.slice(0, 12)}, ` +
            `file ${checksum.slice(0, 12)}). Applied migrations are immutable — add a new ` +
            'migration instead of editing this one.'
        )
      }
      continue
    }

    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum])
      await client.query('COMMIT')
      console.log(`Ran migration: ${file}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
}

/**
 * Brings the database's schema up to date. Called before the HTTP server starts listening, so a
 * migration that fails takes the boot down with it and the previous instance keeps serving.
 *
 * The whole run holds a session-level advisory lock: a rolling deploy briefly runs two instances,
 * and without the lock both would race on the same file. `IF NOT EXISTS` covers some of that by
 * accident, but not statements like a plain `ALTER TABLE … ADD CONSTRAINT`.
 */
export async function runMigrations(): Promise<void> {
  const migrationsDir = resolveMigrationsDir()
  const client = await db.connect()

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID])
    await applyMigrations(client, migrationsDir)
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
    } finally {
      client.release()
    }
  }
}
