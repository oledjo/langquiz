import request from 'supertest'
import { describe, expect, test } from 'vitest'
import { app } from './index'

describe('HTTP body limit', () => {
  test('accepts the 2.2 MB Anki import manifest payload', async () => {
    const response = await request(app)
      .post('/api/health')
      .send({ payload: 'x'.repeat(2_200_000) })

    // There is intentionally no POST health endpoint. A 404 proves parsing succeeded; 413 does not.
    expect(response.status).toBe(404)
  })
})
