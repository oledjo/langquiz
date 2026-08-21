import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signToken } from '../auth/jwt'
import { exercisesRouter } from './exercises'

const query = vi.fn()
vi.mock('../db/database', () => ({ db: { query: (...args: unknown[]) => query(...args) } }))


function app() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/exercises', exercisesRouter)
  return instance
}

function sqlOf(callIndex: number): string {
  return String(query.mock.calls[callIndex]?.[0]).replace(/\s+/g, ' ')
}

describe('GET /api/exercises without a token', () => {
  beforeEach(() => {
    query.mockReset()
  })

  test('returns the questions of official decks only', async () => {
    query.mockResolvedValue({
      rows: [{ data: { id: 'de-articles-1', prompt: 'Which article?' }, deck_id: 3 }],
    })

    const response = await request(app()).get('/api/exercises')

    expect(response.status).toBe(200)
    expect(sqlOf(0)).toContain(`d.origin = 'official'`)
    expect(response.body).toEqual([
      {
        id: 'de-articles-1',
        prompt: 'Which article?',
        isUserAdded: false,
        voteCount: 0,
        userVoted: false,
        deckId: '3',
      },
    ])
  })

  test('never reads user_exercises, so nobody else’s imports leak', async () => {
    query.mockResolvedValue({ rows: [] })

    await request(app()).get('/api/exercises')

    expect(query).toHaveBeenCalledTimes(1)
    expect(sqlOf(0)).not.toContain('user_exercises')
  })

  test('honours the deckId filter', async () => {
    query.mockResolvedValue({ rows: [] })

    await request(app()).get('/api/exercises?deckId=7')

    expect(query.mock.calls[0][1]).toEqual([7])
  })
})

describe('GET /api/exercises with a token', () => {
  beforeEach(() => {
    query.mockReset()
    // 1st call probes for the votes table, then the global and user question queries run.
    query.mockResolvedValueOnce({ rows: [{ exists: null }] }).mockResolvedValue({ rows: [] })
  })

  test('also reads the caller’s own imported questions', async () => {
    const response = await request(app())
      .get('/api/exercises')
      .set('Authorization', `Bearer ${signToken(42, 'user')}`)

    expect(response.status).toBe(200)
    expect(query.mock.calls.some((call) => String(call[0]).includes('user_exercises'))).toBe(true)
  })
})

describe('removed bootstrap endpoint', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue({ rows: [] })
  })

  // It used to accept an arbitrary array of questions from any signed-in user and upsert them
  // into the shared `exercises` table. Content now arrives through backend/scripts, so the
  // endpoint is gone rather than merely restricted.
  test('no longer accepts writes from a signed-in user', async () => {
    const response = await request(app())
      .post('/api/exercises/bootstrap')
      .set('Authorization', `Bearer ${signToken(42, 'user')}`)
      .send([{ id: 'de-articles-1', prompt: 'overwritten' }])

    expect(response.status).toBe(404)
    expect(query).not.toHaveBeenCalled()
  })
})

describe('vote endpoints', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue({ rows: [{ vote_count: 1 }] })
  })

  test('require a token', async () => {
    const response = await request(app()).post('/api/exercises/de-articles-1/vote')

    expect(response.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })
})
