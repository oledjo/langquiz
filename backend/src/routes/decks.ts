import { Router } from 'express'
import { db } from '../db/database'
import { optionalAuth, requireAuth } from '../auth/middleware'
import { mapDeckRow, type DeckRow } from '../decks/deckMapper'

export const decksRouter = Router()

// `learning_paused` is per caller; an anonymous visitor has nothing paused.
function learningPausedSql(userIdParam: string): string {
  return `EXISTS (SELECT 1 FROM user_paused_decks upd WHERE upd.user_id = ${userIdParam} AND upd.deck_id = d.id) AS learning_paused`
}

// Official decks are readable without an account: a visitor has to be able to open a deck and
// answer a few questions before deciding to register. Community decks stay behind a token.
decksRouter.use(optionalAuth)

decksRouter.get('/', async (req, res) => {
  try {
    const result = req.userId
      ? await db.query<DeckRow>(
          `SELECT d.*, ${learningPausedSql('$1')} FROM decks d WHERE (is_private = FALSE OR owner_id = $1) ORDER BY title ASC`,
          [req.userId]
        )
      : await db.query<DeckRow>(`SELECT * FROM decks WHERE origin = 'official' AND is_private = FALSE ORDER BY title ASC`)
    res.json(result.rows.map(mapDeckRow))
  } catch (error) {
    console.error('Failed to load decks:', error)
    res.status(500).json({ error: 'Failed to load decks.' })
  }
})

decksRouter.get('/:slug', async (req, res) => {
  try {
    // A community deck reads as 404 rather than 403 for an anonymous caller: whether a given
    // slug exists is itself owner information, and the client renders both the same way.
    const result = req.userId
      ? await db.query<DeckRow>(
          `SELECT d.*, ${learningPausedSql('$2')} FROM decks d WHERE slug = $1 AND (is_private = FALSE OR owner_id = $2)`,
          [req.params.slug, req.userId]
        )
      : await db.query<DeckRow>(`SELECT * FROM decks WHERE slug = $1 AND origin = 'official' AND is_private = FALSE`, [
          req.params.slug,
        ])
    const row = result.rows[0]
    if (!row) {
      res.status(404).json({ error: 'Deck not found.' })
      return
    }
    res.json(mapDeckRow(row))
  } catch (error) {
    console.error('Failed to load deck:', error)
    res.status(500).json({ error: 'Failed to load deck.' })
  }
})

/**
 * Stops (`paused: true`) or resumes learning a deck for the caller. A paused deck's questions
 * are never due for review; progress history and the review schedule are left untouched, so the
 * statistics stay and resuming continues the schedule where it was.
 */
decksRouter.put('/:deckId/learning-paused', requireAuth, async (req, res) => {
  const deckId = Number(req.params.deckId)
  const { paused } = req.body as { paused?: unknown }
  if (!Number.isSafeInteger(deckId) || deckId <= 0) {
    res.status(400).json({ error: 'Invalid deck id.' })
    return
  }
  if (typeof paused !== 'boolean') {
    res.status(400).json({ error: 'paused (boolean) is required.' })
    return
  }

  try {
    const deckResult = await db.query('SELECT id FROM decks WHERE id = $1 AND (is_private = FALSE OR owner_id = $2)', [
      deckId,
      req.userId,
    ])
    if (!deckResult.rows[0]) {
      res.status(404).json({ error: 'Deck not found.' })
      return
    }

    const changed = paused
      ? await db.query(
          `INSERT INTO user_paused_decks (user_id, deck_id) VALUES ($1, $2) ON CONFLICT (user_id, deck_id) DO NOTHING`,
          [req.userId, deckId]
        )
      : await db.query(`DELETE FROM user_paused_decks WHERE user_id = $1 AND deck_id = $2`, [req.userId, deckId])

    if ((changed.rowCount ?? 0) > 0) {
      // Touch the deck's schedule rows so clients syncing GET /api/progress/schedule?since=…
      // receive their new learningPaused flag.
      await db.query(
        `UPDATE user_review_schedule urs
         SET updated_at = NOW()
         WHERE urs.user_id = $1
           AND urs.exercise_id IN (
             SELECT exercise_id FROM exercises WHERE deck_id = $2
             UNION
             SELECT exercise_id FROM user_exercises WHERE user_id = $1 AND deck_id = $2
           )`,
        [req.userId, deckId]
      )
    }

    res.json({ deckId: String(deckId), learningPaused: paused })
  } catch (error) {
    console.error('Failed to update deck learning state:', error)
    res.status(500).json({ error: 'Failed to update deck.' })
  }
})
