import { createHash } from 'crypto'
import { Router } from 'express'
import { db } from '../db/database'
import { optionalAuth } from '../auth/middleware'

export interface DeckVersionRow {
  id: number
  slug: string
  exercise_count: number
  max_updated: string | null
  deck_updated: string
}

export interface ContentVersionResponse {
  decksCursor: string
  decks: { id: number; slug: string; contentVersion: string }[]
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function computeContentVersion(rows: DeckVersionRow[]): ContentVersionResponse {
  const decks = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    contentVersion: shortHash(
      [row.id, row.deck_updated, row.max_updated ?? 'none', row.exercise_count].join('|')
    ),
  }))
  const decksCursor = shortHash(decks.map((d) => `${d.id}:${d.contentVersion}`).join(','))
  return { decksCursor, decks }
}

export const contentVersionRouter = Router()

contentVersionRouter.use(optionalAuth)

contentVersionRouter.get('/version', async (req, res) => {
  try {
    const officialOnly = !req.userId
    const result = await db.query<DeckVersionRow>(
      `SELECT
         d.id,
         d.slug,
         COUNT(e.exercise_id)::INT AS exercise_count,
         to_char(MAX(e.updated_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS max_updated,
         to_char(d.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS deck_updated
       FROM decks d
       LEFT JOIN exercises e ON e.deck_id = d.id
       WHERE ($1::BOOLEAN IS FALSE OR d.origin = 'official')
       GROUP BY d.id
       ORDER BY d.slug ASC`,
      [officialOnly]
    )
    res.json(computeContentVersion(result.rows))
  } catch (error) {
    console.error('Failed to compute content version:', error)
    res.status(500).json({ error: 'Failed to compute content version' })
  }
})
