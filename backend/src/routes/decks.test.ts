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
