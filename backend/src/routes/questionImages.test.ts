import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signToken } from '../auth/jwt'
import { adminQuestionImagesRouter, questionImagesRouter } from './questionImages'
import { adminRouter } from './admin'
import { requireAdmin, requireAuth } from '../auth/middleware'

const query = vi.fn()
vi.mock('../db/database', () => ({ db: { query: (...args: unknown[]) => query(...args) } }))

const PNG = Buffer.from('89504e470d0a1a0a', 'hex')
const UPDATED_AT = new Date('2026-08-21T12:00:00Z')

function publicApp() {
  const instance = express()
  instance.use('/api/question-images', questionImagesRouter)
  return instance
}

/** The admin routers as they are actually mounted, so requireAuth/requireAdmin are in the path. */
function adminApp() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/admin', adminRouter)
  return instance
}

/** Just the image routes, behind the same guards the admin router applies to them. */
function bareAdminApp() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/admin/question-images', requireAuth, requireAdmin, adminQuestionImagesRouter)
  return instance
}

const adminToken = () => `Bearer ${signToken(1, 'admin')}`

describe('GET /api/question-images/:exerciseId/:slot', () => {
  beforeEach(() => {
    query.mockReset()
  })

  test('serves the stored bytes to a visitor with no token', async () => {
    query.mockResolvedValue({ rows: [{ bytes: PNG, content_type: 'image/png', updated_at: UPDATED_AT }] })

    const response = await request(publicApp()).get('/api/question-images/ebt-21/question')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('image/png')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    // An uploaded SVG is a document if opened directly; this keeps that inert.
    expect(response.headers['content-security-policy']).toContain("default-src 'none'")
    expect(Buffer.from(response.body)).toEqual(PNG)
  })

  test('answers 304 when the caller already has the current version', async () => {
    query.mockResolvedValue({ rows: [{ bytes: PNG, content_type: 'image/png', updated_at: UPDATED_AT }] })

    const response = await request(publicApp())
      .get('/api/question-images/ebt-21/question')
      .set('If-None-Match', `"${UPDATED_AT.getTime()}"`)

    expect(response.status).toBe(304)
  })

  test('404s for a slot with no upload', async () => {
    query.mockResolvedValue({ rows: [] })

    const response = await request(publicApp()).get('/api/question-images/ebt-21/2')

    expect(response.status).toBe(404)
  })

  test('rejects a slot that is neither "question" nor an option index', async () => {
    const response = await request(publicApp()).get('/api/question-images/ebt-21/media')

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})

describe('admin image endpoints', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue({ rows: [], rowCount: 0 })
  })

  test('are closed to a signed-in non-admin', async () => {
    const response = await request(adminApp())
      .put('/api/admin/question-images/ebt-21/question')
      .set('Authorization', `Bearer ${signToken(2, 'user')}`)
      .set('Content-Type', 'image/png')
      .send(PNG)

    expect(response.status).toBe(403)
    expect(query).not.toHaveBeenCalled()
  })

  test('are closed to an anonymous caller', async () => {
    const response = await request(adminApp()).get('/api/admin/question-images/ebt-21')

    expect(response.status).toBe(401)
  })

  test('store an upload for a question that exists', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ exists: true }] }) // question exists
      .mockResolvedValueOnce({ rowCount: 0 }) // no row to update
      .mockResolvedValueOnce({ rowCount: 1 }) // inserted

    const response = await request(bareAdminApp())
      .put('/api/admin/question-images/ebt-21/1?alt=Bundesadler')
      .set('Authorization', adminToken())
      .set('Content-Type', 'image/png')
      .send(PNG)

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ slot: '1', contentType: 'image/png', alt: 'Bundesadler' })
    const insert = query.mock.calls[2]
    expect(String(insert[0])).toContain('INSERT INTO question_images')
    // source 'admin' is what keeps the boot-time seeder from overwriting this slot later.
    expect(insert[1]).toEqual(['ebt-21', 1, PNG, 'image/png', 'Bundesadler', null, 1, 'admin'])
  })

  test('refuse an upload for a question id that does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [{ exists: false }] })

    const response = await request(bareAdminApp())
      .put('/api/admin/question-images/nope/question')
      .set('Authorization', adminToken())
      .set('Content-Type', 'image/png')
      .send(PNG)

    expect(response.status).toBe(404)
  })

  test('refuse a file type a browser would not render as an image', async () => {
    const response = await request(bareAdminApp())
      .put('/api/admin/question-images/ebt-21/question')
      .set('Authorization', adminToken())
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4'))

    expect(response.status).toBe(415)
    expect(query).not.toHaveBeenCalled()
  })

  test('refuse an empty body', async () => {
    const response = await request(bareAdminApp())
      .put('/api/admin/question-images/ebt-21/question')
      .set('Authorization', adminToken())
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(0))

    expect(response.status).toBe(400)
  })

  test('404 when deleting a slot that holds nothing', async () => {
    query.mockResolvedValue({ rowCount: 0 })

    const response = await request(bareAdminApp())
      .delete('/api/admin/question-images/ebt-21/question')
      .set('Authorization', adminToken())

    expect(response.status).toBe(404)
  })

  test('409 when deleting artwork that ships with the app', async () => {
    query
      .mockResolvedValueOnce({ rowCount: 0 }) // nothing admin-owned to delete
      .mockResolvedValueOnce({ rowCount: 1 }) // but a seeded row occupies the slot

    const response = await request(bareAdminApp())
      .delete('/api/admin/question-images/ebt-21/question')
      .set('Authorization', adminToken())

    expect(response.status).toBe(409)
    expect(response.body.error).toMatch(/ships with the app/)
    expect(String(query.mock.calls[0][0])).toContain("source = 'admin'")
  })

  test('update just the description of an existing upload', async () => {
    query.mockResolvedValue({ rowCount: 1 })

    const response = await request(bareAdminApp())
      .patch('/api/admin/question-images/ebt-21/0')
      .set('Authorization', adminToken())
      .send({ alt: 'Neue Beschreibung' })

    expect(response.status).toBe(200)
    expect(query.mock.calls[0][1]).toEqual(['ebt-21', 0, 'Neue Beschreibung', null])
  })
})
