import crypto from 'node:crypto'
import express, { Router } from 'express'
import { db } from '../db/database'
import { contentTypeForPrivateAnkiMedia, isPrivateAnkiMediaHash, PRIVATE_ANKI_MEDIA_TYPES, verifyPrivateAnkiMediaSignature } from '../services/privateAnkiMedia'
import { requireAuth } from '../auth/middleware'

export const privateAnkiMediaRouter = Router()
privateAnkiMediaRouter.post('/import/:sha256', requireAuth, express.raw({ type: 'application/octet-stream', limit: '6mb' }), async (req, res) => {
  const sha256 = typeof req.params.sha256 === 'string' ? req.params.sha256 : ''
  const bytes = req.body
  if (!isPrivateAnkiMediaHash(sha256) || !Buffer.isBuffer(bytes) || bytes.length === 0) {
    res.status(400).json({ error: 'A non-empty media file with a SHA-256 filename is required.' })
    return
  }
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== sha256) {
    res.status(400).json({ error: 'Media bytes do not match the supplied SHA-256.' })
    return
  }
  const contentType = contentTypeForPrivateAnkiMedia(bytes)
  if (!contentType) {
    res.status(415).json({ error: 'Only JPEG, PNG, WebP, and GIF files are supported.' })
    return
  }
  try {
    await db.query(
      `INSERT INTO private_anki_media (user_id, sha256, bytes, content_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, sha256) DO UPDATE SET bytes = EXCLUDED.bytes, content_type = EXCLUDED.content_type`,
      [req.userId, sha256, bytes, contentType]
    )
    res.status(201).json({ sha256, contentType, bytes: bytes.length })
  } catch {
    res.status(500).json({ error: 'Failed to save media.' })
  }
})

privateAnkiMediaRouter.get('/:userId/:sha256', async (req, res) => {
  const { userId, sha256 } = req.params
  const { expires, signature } = req.query
  if (typeof userId !== 'string' || typeof sha256 !== 'string' || typeof expires !== 'string' || typeof signature !== 'string' ||
      !verifyPrivateAnkiMediaSignature(userId, sha256, expires, signature)) {
    res.status(404).end()
    return
  }
  try {
    const result = await db.query<{ bytes: Buffer; content_type: string }>(
      'SELECT bytes, content_type FROM private_anki_media WHERE user_id = $1 AND sha256 = $2', [userId, sha256])
    const row = result.rows[0]
    if (!row || !PRIVATE_ANKI_MEDIA_TYPES.includes(row.content_type)) {
      res.status(404).end()
      return
    }
    const remaining = Math.max(0, Number(expires) - Math.floor(Date.now() / 1000))
    res.set({ 'Content-Type': row.content_type, 'Cache-Control': `private, max-age=${remaining}`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer' })
    res.send(row.bytes)
  } catch {
    res.status(500).json({ error: 'Failed to load media.' })
  }
})
