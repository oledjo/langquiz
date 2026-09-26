import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signToken } from '../auth/jwt'
import { contentVersionRouter } from './contentVersion'

const query = vi.fn()
vi.mock('../db/database', () => ({ db: { query: (...args: unknown[]) => query(...args) } }))

function app() {
  const instance = express()
  instance.use('/api/content', contentVersionRouter)
  return instance
}

const flatSql = () => String(query.mock.calls[0]?.[0]).replace(/\s+/g, ' ')

describe('GET /api/content/version visibility', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue({ rows: [] })
  })

  test('a visitor gets official public decks only', async () => {
    const response = await request(app()).get('/api/content/version')
    expect(response.status).toBe(200)
    expect(flatSql()).toContain(`d.origin = 'official' AND d.is_private = FALSE`)
    expect(query.mock.calls[0][1]).toEqual([null])
  })

  test("a signed-in user sees public decks plus only their own private decks and questions", async () => {
    const response = await request(app())
      .get('/api/content/version')
      .set('Authorization', `Bearer ${signToken(7, 'user')}`)
    expect(response.status).toBe(200)
    expect(flatSql()).toContain('d.is_private = FALSE OR d.owner_id = $1')
    expect(flatSql()).toContain('FROM user_exercises WHERE user_id = $1')
    expect(query.mock.calls[0][1]).toEqual([7])
  })
})
