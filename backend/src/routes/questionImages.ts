import { Router, raw } from 'express'
import { db } from '../db/database'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  normalizeContentType,
  optionIndexToSlot,
  parseImageSlot,
  slotToOptionIndex,
} from '../services/questionImages'

/** Reading artwork is as public as reading the question it belongs to — guests included. */
export const questionImagesRouter = Router()

questionImagesRouter.get('/:exerciseId/:slot', async (req, res) => {
  const slot = parseImageSlot(req.params.slot)
  if (!slot) {
    res.status(400).json({ error: 'Slot must be "question" or an option index 0-9.' })
    return
  }

  try {
    const result = await db.query<{ bytes: Buffer; content_type: string; updated_at: Date }>(
      `SELECT bytes, content_type, updated_at
         FROM question_images
        WHERE exercise_id = $1 AND option_index IS NOT DISTINCT FROM $2`,
      [req.params.exerciseId, slotToOptionIndex(slot)]
    )
    const row = result.rows[0]
    if (!row) {
      res.status(404).json({ error: 'Image not found.' })
      return
    }

    const etag = `"${new Date(row.updated_at).getTime()}"`
    res.setHeader('ETag', etag)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Type', row.content_type)
    // An uploaded SVG is a document as far as a browser is concerned. Nothing in the app ever
    // navigates to one — they are only ever <img> sources, where scripts do not run — but these
    // headers make a hand-typed URL inert too.
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end()
      return
    }
    res.send(row.bytes)
  } catch (error) {
    console.error('Failed to load question image:', error)
    res.status(500).json({ error: 'Failed to load image.' })
  }
})

/** Mounted inside the admin router, so requireAuth + requireAdmin already apply. */
export const adminQuestionImagesRouter = Router()

function readTextParam(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

const MAX_ALT_LENGTH = 2000
const MAX_ATTRIBUTION_LENGTH = 300

async function questionExists(exerciseId: string): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM exercises WHERE exercise_id = $1
       UNION ALL
       SELECT 1 FROM user_exercises WHERE exercise_id = $1
     ) AS exists`,
    [exerciseId]
  )
  return Boolean(result.rows[0]?.exists)
}

adminQuestionImagesRouter.get('/:exerciseId', async (req, res) => {
  try {
    const result = await db.query<{
      option_index: number | null
      content_type: string
      alt: string
      attribution: string | null
      size: number
      updated_at: Date
    }>(
      `SELECT option_index, content_type, alt, attribution, octet_length(bytes) AS size, updated_at
         FROM question_images
        WHERE exercise_id = $1
        ORDER BY option_index NULLS FIRST`,
      [req.params.exerciseId]
    )

    res.json(
      result.rows.map((row) => ({
        slot: optionIndexToSlot(row.option_index),
        contentType: row.content_type,
        alt: row.alt,
        attribution: row.attribution,
        size: Number(row.size),
        updatedAt: row.updated_at,
      }))
    )
  } catch (error) {
    console.error('Failed to list question images:', error)
    res.status(500).json({ error: 'Failed to list images.' })
  }
})

adminQuestionImagesRouter.put(
  '/:exerciseId/:slot',
  raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const slot = parseImageSlot(req.params.slot)
    if (!slot) {
      res.status(400).json({ error: 'Slot must be "question" or an option index 0-9.' })
      return
    }

    const contentType = normalizeContentType(req.header('content-type'))
    if (!contentType) {
      res.status(415).json({ error: `Unsupported image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}.` })
      return
    }

    const bytes = Buffer.isBuffer(req.body) ? req.body : null
    if (!bytes || bytes.length === 0) {
      res.status(400).json({ error: 'Request body must be the image file.' })
      return
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: `Image is larger than ${Math.floor(MAX_IMAGE_BYTES / 1024)} KB.` })
      return
    }

    const alt = readTextParam(req.query.alt, MAX_ALT_LENGTH) ?? ''
    const attribution = readTextParam(req.query.attribution, MAX_ATTRIBUTION_LENGTH)
    const optionIndex = slotToOptionIndex(slot)

    try {
      if (!(await questionExists(req.params.exerciseId))) {
        res.status(404).json({ error: 'Question not found.' })
        return
      }

      // Upsert by hand: the table's uniqueness lives in two partial indexes (one for the
      // question illustration, one per option), which ON CONFLICT cannot target in one statement.
      const updated = await db.query(
        `UPDATE question_images
            SET bytes = $3, content_type = $4, alt = $5, attribution = $6, uploaded_by = $7, updated_at = NOW()
          WHERE exercise_id = $1 AND option_index IS NOT DISTINCT FROM $2`,
        [req.params.exerciseId, optionIndex, bytes, contentType, alt, attribution, req.userId ?? null]
      )

      if (!updated.rowCount) {
        await db.query(
          `INSERT INTO question_images (exercise_id, option_index, bytes, content_type, alt, attribution, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.params.exerciseId, optionIndex, bytes, contentType, alt, attribution, req.userId ?? null]
        )
      }

      res.status(201).json({ slot: req.params.slot, contentType, size: bytes.length, alt, attribution })
    } catch (error) {
      console.error('Failed to store question image:', error)
      res.status(500).json({ error: 'Failed to store image.' })
    }
  }
)

adminQuestionImagesRouter.patch('/:exerciseId/:slot', async (req, res) => {
  const slot = parseImageSlot(req.params.slot)
  if (!slot) {
    res.status(400).json({ error: 'Slot must be "question" or an option index 0-9.' })
    return
  }

  const body = req.body as { alt?: unknown; attribution?: unknown } | null
  const alt = typeof body?.alt === 'string' ? body.alt.slice(0, MAX_ALT_LENGTH) : null
  if (alt === null) {
    res.status(400).json({ error: 'alt is required.' })
    return
  }
  const attribution = readTextParam(body?.attribution, MAX_ATTRIBUTION_LENGTH)

  try {
    const result = await db.query(
      `UPDATE question_images
          SET alt = $3, attribution = $4, updated_at = NOW()
        WHERE exercise_id = $1 AND option_index IS NOT DISTINCT FROM $2`,
      [req.params.exerciseId, slotToOptionIndex(slot), alt, attribution]
    )
    if (!result.rowCount) {
      res.status(404).json({ error: 'Image not found.' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to update question image:', error)
    res.status(500).json({ error: 'Failed to update image.' })
  }
})

adminQuestionImagesRouter.delete('/:exerciseId/:slot', async (req, res) => {
  const slot = parseImageSlot(req.params.slot)
  if (!slot) {
    res.status(400).json({ error: 'Slot must be "question" or an option index 0-9.' })
    return
  }

  try {
    const result = await db.query(
      `DELETE FROM question_images WHERE exercise_id = $1 AND option_index IS NOT DISTINCT FROM $2`,
      [req.params.exerciseId, slotToOptionIndex(slot)]
    )
    if (!result.rowCount) {
      res.status(404).json({ error: 'Image not found.' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to delete question image:', error)
    res.status(500).json({ error: 'Failed to delete image.' })
  }
})
