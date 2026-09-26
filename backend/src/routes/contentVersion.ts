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
    // Same visibility as GET /api/decks: visitors see official public decks; a signed-in user
    // sees every public deck plus their own private ones — never another user's private deck.
    // A deck's version also covers the caller's own questions (user_exercises), so edits to a
    // user deck or an Anki import move the cursor.
    const result = await db.query<DeckVersionRow>(
      `SELECT
         d.id,
         d.slug,
         (COALESCE(e.cnt, 0) + COALESCE(u.cnt, 0))::INT AS exercise_count,
         to_char(GREATEST(e.max_updated, u.max_created) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS max_updated,
         to_char(d.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS deck_updated
       FROM decks d
       LEFT JOIN (
         SELECT deck_id, COUNT(*) AS cnt, MAX(updated_at) AS max_updated FROM exercises GROUP BY deck_id
       ) e ON e.deck_id = d.id
       LEFT JOIN (
         SELECT deck_id, COUNT(*) AS cnt, MAX(created_at) AS max_created
         FROM user_exercises WHERE user_id = $1 GROUP BY deck_id
       ) u ON u.deck_id = d.id
       WHERE CASE
         WHEN $1::BIGINT IS NULL THEN d.origin = 'official' AND d.is_private = FALSE
         ELSE d.is_private = FALSE OR d.owner_id = $1
       END
       ORDER BY d.slug ASC`,
      [req.userId ?? null]
    )
    res.json(computeContentVersion(result.rows))
  } catch (error) {
    console.error('Failed to compute content version:', error)
    res.status(500).json({ error: 'Failed to compute content version' })
  }
})
