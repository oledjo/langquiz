import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signToken } from '../auth/jwt'
import { decksRouter } from './decks'

const query = vi.fn()
vi.mock('../db/database', () => ({ db: { query: (...args: unknown[]) => query(...args) } }))


function app() {
  const instance = express()
  instance.use('/api/decks', decksRouter)
  return instance
}

/** The SQL a handler ran, whitespace-collapsed so assertions don't depend on formatting. */
function lastSql(): string {
  return String(query.mock.calls.at(-1)?.[0]).replace(/\s+/g, ' ')
}

describe('GET /api/decks', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue({ rows: [] })
  })

  test('serves official decks to a visitor with no token', async () => {
    const response = await request(app()).get('/api/decks')

    expect(response.status).toBe(200)
    expect(lastSql()).toContain(`origin = 'official'`)
  })

  test('serves every deck to a signed-in user', async () => {
    const response = await request(app())
      .get('/api/decks')
      .set('Authorization', `Bearer ${signToken(1, 'user')}`)

    expect(response.status).toBe(200)
    expect(lastSql()).not.toContain(`origin = 'official'`)
  })

  test('rejects a token that is present but invalid, rather than serving the anonymous view', async () => {
    const response = await request(app()).get('/api/decks').set('Authorization', 'Bearer not-a-token')

    expect(response.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })
})

describe('GET /api/decks/:slug', () => {
  beforeEach(() => {
    query.mockReset()
  })

  test('hides a community deck from a visitor', async () => {
    query.mockResolvedValue({ rows: [] })

    const response = await request(app()).get('/api/decks/someones-deck')

    expect(response.status).toBe(404)
    expect(lastSql()).toContain(`origin = 'official'`)
  })

  test('returns an official deck to a visitor', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: 1,
          slug: 'einbuergerungstest',
          title: 'Einbürgerungstest',
          description: '',
          origin: 'official',
          owner_id: null,
          study_modes: ['practice', 'exam'],
          facet_definitions: [],
          locales: ['de'],
          exam_config: null,
          answer_rule_id: null,
        },
      ],
    })

    const response = await request(app()).get('/api/decks/einbuergerungstest')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ slug: 'einbuergerungstest', origin: 'official' })
  })
})

describe('private deck isolation', () => {
  beforeEach(() => { query.mockReset(); query.mockResolvedValue({ rows: [] }) })
  test('anonymous list excludes private official decks too', async () => {
    await request(app()).get('/api/decks')
    expect(lastSql()).toContain('is_private = FALSE')
  })
  test('signed in list is restricted to public decks or own private decks', async () => {
    await request(app()).get('/api/decks').set('Authorization', `Bearer ${signToken(42, 'user')}`)
    expect(lastSql()).toContain('(is_private = FALSE OR owner_id = $1)')
    expect(query.mock.calls[0][1]).toEqual([42])
  })
  test('private slug lookup is restricted by owner even for administrators', async () => {
    const response = await request(app()).get('/api/decks/private').set('Authorization', `Bearer ${signToken(43, 'admin')}`)
    expect(response.status).toBe(404)
    expect(lastSql()).toContain('(is_private = FALSE OR owner_id = $2)')
    expect(query.mock.calls[0][1]).toEqual(['private', 43])
  })
  test('anonymous slug lookup excludes private decks', async () => {
    const response = await request(app()).get('/api/decks/private')
    expect(response.status).toBe(404)
    expect(lastSql()).toContain('is_private = FALSE')
  })
})

describe('PUT /api/decks/:deckId/learning-paused', () => {
  function jsonApp() {
    const instance = express()
    instance.use(express.json())
    instance.use('/api/decks', decksRouter)
    return instance
  }
  const token = () => `Bearer ${signToken(7, 'user')}`

  beforeEach(() => {
    query.mockReset()
  })

  test('requires a signed-in user', async () => {
    const response = await request(jsonApp()).put('/api/decks/3/learning-paused').send({ paused: true })
    expect(response.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })

  test('rejects a missing paused flag', async () => {
    const response = await request(jsonApp()).put('/api/decks/3/learning-paused').set('Authorization', token()).send({})
    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  test('404s for a deck the caller cannot see', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 })
    const response = await request(jsonApp())
      .put('/api/decks/3/learning-paused')
      .set('Authorization', token())
      .send({ paused: true })
    expect(response.status).toBe(404)
    expect(query).toHaveBeenCalledTimes(1)
  })

  test('pauses a deck and touches its schedule rows for incremental sync', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 3 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 5 })
    const response = await request(jsonApp())
      .put('/api/decks/3/learning-paused')
      .set('Authorization', token())
      .send({ paused: true })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ deckId: '3', learningPaused: true })
    expect(String(query.mock.calls[1][0])).toContain('INSERT INTO user_paused_decks')
    expect(query.mock.calls[1][1]).toEqual([7, 3])
    expect(String(query.mock.calls[2][0])).toContain('UPDATE user_review_schedule')
  })

  test('resuming an already-active deck changes nothing', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 3 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const response = await request(jsonApp())
      .put('/api/decks/3/learning-paused')
      .set('Authorization', token())
      .send({ paused: false })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ deckId: '3', learningPaused: false })
    expect(String(query.mock.calls[1][0])).toContain('DELETE FROM user_paused_decks')
    expect(query).toHaveBeenCalledTimes(2)
  })
})
