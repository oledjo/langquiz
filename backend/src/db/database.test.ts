import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { applyMigrations, checksumOf, type MigrationClient } from './database'

/**
 * A pg client stand-in that remembers the `schema_migrations` rows and records every statement,
 * so a test can assert what the runner did without a live Postgres.
 */
class FakeClient implements MigrationClient {
  applied = new Map<string, string | null>()
  ran: string[] = []

  async query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: unknown[] = []
  ): Promise<{ rows: R[]; rowCount: number | null }> {
    this.ran.push(text.trim().split('\n')[0])

    if (text.includes('SELECT name, checksum FROM schema_migrations')) {
      const rows = [...this.applied].map(([name, checksum]) => ({ name, checksum }))
      return { rows: rows as unknown as R[], rowCount: rows.length }
    }
    if (text.startsWith('INSERT INTO schema_migrations')) {
      this.applied.set(values[0] as string, values[1] as string)
      return { rows: [], rowCount: 1 }
    }
    if (text.startsWith('UPDATE schema_migrations SET checksum')) {
      this.applied.set(values[0] as string, values[1] as string)
      return { rows: [], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  }
}

describe('applyMigrations', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function write(name: string, sql: string): void {
    fs.writeFileSync(path.join(dir, name), sql)
  }

  test('applies pending files in filename order and records their checksums', async () => {
    write('002_second.sql', 'SELECT 2')
    write('001_first.sql', 'SELECT 1')
    const client = new FakeClient()

    await applyMigrations(client, dir)

    expect([...client.applied.keys()]).toEqual(['001_first.sql', '002_second.sql'])
    expect(client.applied.get('001_first.sql')).toBe(checksumOf('SELECT 1'))
    expect(client.ran).toContain('SELECT 1')
    expect(client.ran).toContain('SELECT 2')
  })

  test('skips a file that is already applied', async () => {
    write('001_first.sql', 'SELECT 1')
    const client = new FakeClient()
    client.applied.set('001_first.sql', checksumOf('SELECT 1'))

    await applyMigrations(client, dir)

    expect(client.ran).not.toContain('SELECT 1')
  })

  test('throws when an applied file has been edited since', async () => {
    write('001_first.sql', 'SELECT 1 -- edited after the fact')
    const client = new FakeClient()
    client.applied.set('001_first.sql', checksumOf('SELECT 1'))

    await expect(applyMigrations(client, dir)).rejects.toThrow(/has changed since it was applied/)
  })

  test('adopts the checksum of a row recorded before checksums existed', async () => {
    write('001_first.sql', 'SELECT 1')
    const client = new FakeClient()
    client.applied.set('001_first.sql', null)

    await applyMigrations(client, dir)

    expect(client.applied.get('001_first.sql')).toBe(checksumOf('SELECT 1'))
    // Adopting is not re-running: the statement itself must not be executed a second time.
    expect(client.ran).not.toContain('SELECT 1')
  })

  test('tolerates an applied row whose file has been deleted', async () => {
    write('002_second.sql', 'SELECT 2')
    const client = new FakeClient()
    client.applied.set('001_deleted.sql', checksumOf('SELECT 1'))

    await expect(applyMigrations(client, dir)).resolves.toBeUndefined()
    expect(client.applied.has('002_second.sql')).toBe(true)
  })

  test('ignores files that are not .sql', async () => {
    write('001_first.sql', 'SELECT 1')
    write('README.md', 'not a migration')
    const client = new FakeClient()

    await applyMigrations(client, dir)

    expect([...client.applied.keys()]).toEqual(['001_first.sql'])
  })

  test('rolls back and rethrows when a migration statement fails', async () => {
    write('001_first.sql', 'BOOM')
    const client = new FakeClient()
    const failing: MigrationClient = {
      query: async (text, values) => {
        if (text.trim() === 'BOOM') throw new Error('syntax error')
        return client.query(text, values)
      },
    }

    await expect(applyMigrations(failing, dir)).rejects.toThrow('syntax error')
    expect(client.ran).toContain('ROLLBACK')
    expect(client.applied.has('001_first.sql')).toBe(false)
  })
})

describe('repository migrations', () => {
  const migrationsDir = path.resolve(__dirname, 'migrations')

  test('includes the Anki import audit tables with backend-only RLS', () => {
    const executedSql = fs.readFileSync(path.join(migrationsDir, '019_anki_import.sql'), 'utf8')

    expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS anki_import_runs')
    expect(executedSql).toContain('UNIQUE (user_id, anki_card_id)')
    expect(executedSql).toContain('ALTER TABLE anki_import_runs ENABLE ROW LEVEL SECURITY')
  })

  test('are uniquely and consistently numbered', () => {
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'))
    const numbers = files.map((file) => {
      const match = file.match(/^(\d{3})_/)
      if (!match) throw new Error(`Migration ${file} does not start with a three-digit number.`)
      return match[1]
    })

    expect(new Set(numbers).size, 'two migrations share a number').toBe(numbers.length)
    expect([...files].sort()).toEqual(files.sort())
  })
})
