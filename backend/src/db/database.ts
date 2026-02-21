import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations')

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
  const files = fs.readdirSync(MIGRATIONS_DIR).sort()

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

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
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
