import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signToken } from '../auth/jwt'
import { ankiImportRouter } from './ankiImport'

const query = vi.fn()
const connect = vi.fn()
vi.mock('../db/database', () => ({ db: { connect: (...args: unknown[]) => connect(...args) } }))

function app() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/anki-import', ankiImportRouter)
  return instance
}

const candidate = {
  status: 'ready',
  exercise: { id: 'anki-1', type: 'free-type', topic: 'Anki import', subtopic: 'German', language: 'de', difficulty: 3, group: 'vocabulary', prompt: 'Haus', answers: ['house'], isUserAdded: true, shareStatus: 'private' },
  source: { ankiCardId: '1', ankiNoteId: '2', deck: 'German', model: 'Basic' },
  schedule: { repetitionCount: 3, intervalDays: 14, lapseCount: 1, easeFactor: 2.5, state: 2, dueAt: '2026-09-06T00:00:00.000Z', lastReviewedAt: null, sourceScheduler: 'anki-sm2', schedulerVersion: 'anki-sm2-import-v1' },
}

const manifest = { candidates: [candidate], sourceDecks: ['German'], importerVersion: 'anki-local-v1' }

async function withDryRunHash(body = manifest) {
  const analyzed = await request(app())
    .post('/api/anki-import/analyze')
    .set('Authorization', `Bearer ${signToken(1, 'user')}`)
    .send(body)
    .expect(200)
  return { ...body, manifestHash: analyzed.body.manifest_hash }
}

describe('Anki import API', () => {
  beforeEach(() => {
    query.mockReset()
    connect.mockReset()
    connect.mockResolvedValue({ query, release: vi.fn() })
    query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT 1 FROM anki_import_card_mappings')) return Promise.resolve({ rows: [], rowCount: 0 })
      if (sql.includes('INSERT INTO anki_import_runs')) return Promise.resolve({ rows: [{ id: 11 }], rowCount: 1 })
      return Promise.resolve({ rows: [], rowCount: 1 })
    })
  })

  test('requires authentication', async () => {
    await request(app()).post('/api/anki-import/analyze').send(manifest).expect(401)
  })

  test('rejects a mismatched manifest hash', async () => {
    const response = await request(app())
      .post('/api/anki-import/analyze')
      .set('Authorization', `Bearer ${signToken(1, 'user')}`)
      .send({ ...manifest, manifestHash: 'not-the-real-hash' })
      .expect(400)
    expect(response.body.error).toContain('manifest hash')
  })

  test('analyzes without accepting review history and explicitly reports it unavailable', async () => {
    const response = await request(app())
      .post('/api/anki-import/analyze')
      .set('Authorization', `Bearer ${signToken(1, 'user')}`)
      .send(manifest)
      .expect(200)

    expect(response.body.history_status).toBe('unavailable')
    expect(response.body.manifest_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(query).not.toHaveBeenCalled()
  })

  test('applies a validated manifest in one transaction using private, user-scoped upserts', async () => {
    const approved = await withDryRunHash()
    await request(app())
      .post('/api/anki-import/apply')
      .set('Authorization', `Bearer ${signToken(1, 'user')}`)
      .send(approved)
      .expect(201)

    const sql = query.mock.calls.map((call) => String(call[0]).replace(/\s+/g, ' ')).join('\n')
    expect(sql).toContain('BEGIN')
    expect(sql).toContain('INSERT INTO user_exercises')
    expect(sql).toContain('INSERT INTO user_review_schedule')
    expect(sql).toContain('ON CONFLICT (user_id, anki_card_id)')
    expect(sql).toContain('COMMIT')
    const scheduleCall = query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO user_review_schedule'))
    expect(scheduleCall?.[1]).toContain('anki-sm2-import-v1')
  })

  test('requires the dry-run manifest hash before opening a transaction', async () => {
    await request(app())
      .post('/api/anki-import/apply')
      .set('Authorization', `Bearer ${signToken(1, 'user')}`)
      .send(manifest)
      .expect(400)
    expect(connect).not.toHaveBeenCalled()
  })

  test('rejects duplicate or mismatched ready candidates before database access', async () => {
    const invalid = { ...manifest, candidates: [{ ...candidate, exercise: { ...candidate.exercise, id: 'wrong-id' } }, candidate] }
    const approved = await withDryRunHash(invalid)
    await request(app())
      .post('/api/anki-import/apply')
      .set('Authorization', `Bearer ${signToken(1, 'user')}`)
      .send(approved)
      .expect(400)
    expect(connect).not.toHaveBeenCalled()
  })

  test('marks an identical second apply skipped without rewriting exercise or schedule', async () => {
    const approved = await withDryRunHash()
    query.mockImplementation((sql: string, values?: unknown[]) => {
      // The query compares both hashes, so a row represents the exact mapping left by the first apply.
      if (sql.includes('SELECT 1 FROM anki_import_card_mappings')) return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 })
      if (sql.includes('INSERT INTO anki_import_runs')) return Promise.resolve({ rows: [{ id: 12 }], rowCount: 1 })
      return Promise.resolve({ rows: [], rowCount: 1 })
    })
    const response = await request(app()).post('/api/anki-import/apply').set('Authorization', `Bearer ${signToken(1, 'user')}`).send(approved).expect(201)
    const sql = query.mock.calls.map((call) => String(call[0])).join('\n')
    expect(response.body.skipped_unchanged).toBe(1)
    expect(sql).not.toContain('INSERT INTO user_exercises')
    expect(sql).not.toContain('INSERT INTO user_review_schedule')
    expect(sql).toContain("'skipped_unchanged'")
  })
})
