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

export async function runMigrations(): Promise<void> {
  const migrationsDir = resolveMigrationsDir()
  const files = fs.readdirSync(migrationsDir).sort()

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  for (const file of files) {
    if (!file.endsWith('.sql')) continue
    const alreadyApplied = await db.query('SELECT 1 FROM schema_migrations WHERE name = $1 LIMIT 1', [file])
    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) continue

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`Ran migration: ${file}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
