import Anthropic from '@anthropic-ai/sdk'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signToken } from '../auth/jwt'
import { decksRouter } from './decks'
import { deckEditorRouter, setAnthropicClientForTests } from './deckEditor'

const query = vi.fn()
vi.mock('../db/database', () => ({ db: { query: (...args: unknown[]) => query(...args) } }))

const UA = 'Mozilla/5.0 test'
const auth = (userId = 7) => ({ Authorization: `Bearer ${signToken(userId, 'user')}`, 'User-Agent': UA })

const deckRow = {
  id: 42, slug: 'biology-abc123', title: 'Biology', description: '', origin: 'community', owner_id: 7,
  study_modes: ['practice'], facet_definitions: [], locales: ['en'], exam_config: null, answer_rule_id: null,
}

function app() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/decks', decksRouter)
  instance.use('/api/decks', deckEditorRouter)
  return instance
}

const sqlCalls = () => query.mock.calls.map((call) => String(call[0]).replace(/\s+/g, ' '))

/** Route each SQL statement to a canned result by its leading keyword/table. */
function routeQueries(overrides: Record<string, unknown> = {}) {
  query.mockImplementation(async (sql: string) => {
    const s = sql.replace(/\s+/g, ' ')
    for (const [needle, result] of Object.entries(overrides)) if (s.includes(needle)) return result
    if (s.startsWith('SELECT * FROM decks WHERE id')) return { rows: [deckRow] }
    if (s.startsWith('INSERT INTO decks')) return { rows: [deckRow] }
    if (s.startsWith('SELECT COUNT')) return { rows: [{ count: 0 }] }
    return { rows: [], rowCount: 1 }
  })
}

beforeEach(() => {
  query.mockReset()
  routeQueries()
})
afterEach(() => setAnthropicClientForTests(undefined))

describe('mounting', () => {
  test('public deck list still works without a token', async () => {
    query.mockResolvedValue({ rows: [] })
    const response = await request(app()).get('/api/decks')
    expect(response.status).toBe(200)
  })

  test('editing requires a token', async () => {
    const response = await request(app()).post('/api/decks').set('User-Agent', UA).send({ title: 'x' })
    expect(response.status).toBe(401)
  })
})

describe('POST /api/decks', () => {
  test('creates a private community deck owned by the caller', async () => {
    const response = await request(app()).post('/api/decks').set(auth()).send({ title: 'Biology', language: 'en' })
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ id: '42', title: 'Biology', ownerId: '7' })
    const [sql, params] = query.mock.calls[0]
    expect(String(sql)).toContain(`'community', $4, TRUE`)
    expect(params[0]).toMatch(/^biology-[0-9a-f]{6}$/)
    expect(params[3]).toBe(7)
  })

  test('rejects a missing title', async () => {
    const response = await request(app()).post('/api/decks').set(auth()).send({ title: '  ' })
    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})

describe('ownership', () => {
  test("another user's deck reads as 404", async () => {
    routeQueries({ 'SELECT * FROM decks WHERE id': { rows: [] } })
    const response = await request(app()).delete('/api/decks/42').set(auth(8))
    expect(response.status).toBe(404)
    expect(sqlCalls().some((s) => s.startsWith('DELETE'))).toBe(false)
  })

  test('deleting a deck removes its questions first', async () => {
    const response = await request(app()).delete('/api/decks/42').set(auth())
    expect(response.status).toBe(204)
    const deletes = sqlCalls().filter((s) => s.startsWith('DELETE'))
    expect(deletes[0]).toContain('FROM user_exercises')
    expect(deletes[1]).toContain('FROM decks')
  })
})

describe('questions', () => {
  const question = { type: 'selection', prompt: 'Powerhouse of the cell?', options: ['Mitochondria', 'Ribosome'], answer: 0 }

  test('adds validated questions with server-made ids into the deck', async () => {
    const response = await request(app()).post('/api/decks/42/questions').set(auth()).send({ questions: [question] })
    expect(response.status).toBe(201)
    const created = response.body.questions[0]
    expect(created).toMatchObject({ prompt: 'Powerhouse of the cell?', deckId: '42', topic: 'Biology', isUserAdded: true })
    expect(created.id).toMatch(/^deck-42-/)
    const insert = query.mock.calls.find((call) => String(call[0]).startsWith('INSERT INTO user_exercises'))!
    expect(insert[1]).toEqual([7, created.id, expect.objectContaining({ id: created.id }), 42])
  })

  test('reports which question is invalid and saves nothing', async () => {
    const response = await request(app())
      .post('/api/decks/42/questions')
      .set(auth())
      .send({ questions: [question, { ...question, answer: 5 }] })
    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ index: 1 })
    expect(sqlCalls().some((s) => s.startsWith('INSERT'))).toBe(false)
  })

  test('updating a question that does not exist is a 404', async () => {
    routeQueries({ 'UPDATE user_exercises': { rows: [], rowCount: 0 } })
    const response = await request(app()).put('/api/decks/42/questions/deck-42-nope').set(auth()).send(question)
    expect(response.status).toBe(404)
  })
})

describe('POST /api/decks/:id/generate', () => {
  test('503 when no API key is configured', async () => {
    setAnthropicClientForTests(null)
    const response = await request(app()).post('/api/decks/42/generate').set(auth()).send({ topic: 'cells', count: 3 })
    expect(response.status).toBe(503)
  })

  test('returns a validated draft without saving it', async () => {
    const parse = vi.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: {
        exercises: [
          { type: 'free-type', prompt: 'Basic unit of life?', options: [], correct_indices: [], accepted_answers: ['cell'], explanation: '' },
        ],
      },
    })
    setAnthropicClientForTests({ beta: { messages: { parse } } } as unknown as Anthropic)
    const response = await request(app()).post('/api/decks/42/generate').set(auth()).send({ topic: 'cells', count: 1 })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ dropped: 0, questions: [{ type: 'free-type', answers: ['cell'] }] })
    expect(sqlCalls().some((s) => s.startsWith('INSERT'))).toBe(false)
  })

  test('rejects an empty request', async () => {
    const response = await request(app()).post('/api/decks/42/generate').set(auth()).send({ count: 3 })
    expect(response.status).toBe(400)
  })
})
