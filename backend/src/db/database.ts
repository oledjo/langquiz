import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.resolve(__dirname, '../../data/langquiz.db')
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function runMigrations(): void {
  const files = fs.readdirSync(MIGRATIONS_DIR).sort()
  for (const file of files) {
    if (!file.endsWith('.sql')) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    db.exec(sql)
    console.log(`Ran migration: ${file}`)
  }
}
