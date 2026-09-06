import { Router } from 'express'
import { db } from '../db/database'
import { PRIVATE_ANKI_MEDIA_TYPES, verifyPrivateAnkiMediaSignature } from '../services/privateAnkiMedia'

export const privateAnkiMediaRouter = Router()
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
