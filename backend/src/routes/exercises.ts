import { Router } from 'express'
import { db } from '../db/database'
import { optionalAuth, requireAuth } from '../auth/middleware'
import { mergeQuestionImages, type StoredQuestionImage } from '../services/questionImages'

export const exercisesRouter = Router()

function collectExerciseIds(payloads: Record<string, unknown>[]): string[] {
  return payloads.map((payload) => payload.id).filter((id): id is string => typeof id === 'string')
}

/**
 * Artwork an admin uploaded for any of these questions. Read separately from the question rows —
 * uploads live in their own table so a content re-import cannot wipe them (migration 016).
 */
async function loadQuestionImages(exerciseIds: string[]): Promise<StoredQuestionImage[]> {
  if (exerciseIds.length === 0) return []
  const result = await db.query<StoredQuestionImage>(
    `SELECT exercise_id, option_index, alt, attribution, updated_at
       FROM question_images
      WHERE exercise_id = ANY($1::TEXT[])`,
    [exerciseIds]
  )
  return result.rows
}

// Reading questions is open to visitors (see decksRouter for why), but an anonymous caller only
// ever sees the questions of official decks — never anyone's imported ones.
exercisesRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const deckId = typeof req.query.deckId === 'string' && req.query.deckId !== '' ? Number(req.query.deckId) : null
    const hasDeckFilter = deckId !== null && Number.isFinite(deckId)

    if (!req.userId) {
      const officialResult = await db.query<{ data: Record<string, unknown>; deck_id: number }>(
        `SELECT e.data, e.deck_id
           FROM exercises e
           JOIN decks d ON d.id = e.deck_id
          WHERE d.origin = 'official'
            AND ($1::BIGINT IS NULL OR e.deck_id = $1)
          ORDER BY e.exercise_id ASC`,
        [hasDeckFilter ? deckId : null]
      )

      const official = officialResult.rows.map((row) => ({
        ...row.data,
        isUserAdded: false,
        voteCount: 0,
        userVoted: false,
        deckId: String(row.deck_id),
      }))

      res.json(mergeQuestionImages(official, await loadQuestionImages(collectExerciseIds(official))))
      return
    }

    const votesTableResult = await db.query<{ exists: string | null }>(
      `SELECT to_regclass('public.exercise_votes') AS exists`
    )
    const hasVotesTable = Boolean(votesTableResult.rows[0]?.exists)

    const globalResult = hasVotesTable
      ? await db.query(
          `SELECT
             e.id,
             e.exercise_id,
             e.data,
             e.deck_id,
             COALESCE(v.vote_count, 0)::INT AS vote_count,
             (uv.exercise_id IS NOT NULL) AS user_voted
           FROM exercises e
           LEFT JOIN (
             SELECT exercise_id, COUNT(*)::INT AS vote_count
             FROM exercise_votes
             GROUP BY exercise_id
           ) v ON v.exercise_id = e.exercise_id
           LEFT JOIN exercise_votes uv
             ON uv.exercise_id = e.exercise_id AND uv.user_id = $1
           WHERE ($2::BIGINT IS NULL OR e.deck_id = $2)
           ORDER BY e.exercise_id ASC`,
          [req.userId, hasDeckFilter ? deckId : null]
        )
      : await db.query(
          `SELECT
             e.id,
             e.exercise_id,
             e.data,
             e.deck_id,
             0::INT AS vote_count,
             FALSE AS user_voted
           FROM exercises e
           WHERE ($1::BIGINT IS NULL OR e.deck_id = $1)
           ORDER BY e.exercise_id ASC`,
          [hasDeckFilter ? deckId : null]
        )
    const userResult = hasVotesTable
      ? await db.query(
          `SELECT
             ue.id,
             ue.exercise_id,
             ue.data,
             ue.share_status,
             ue.deck_id,
             COALESCE(v.vote_count, 0) AS vote_count,
             (uv.exercise_id IS NOT NULL) AS user_voted
           FROM user_exercises ue
           LEFT JOIN (
             SELECT exercise_id, COUNT(*)::INT AS vote_count
             FROM exercise_votes
             GROUP BY exercise_id
           ) v ON v.exercise_id = ue.exercise_id
           LEFT JOIN exercise_votes uv
             ON uv.exercise_id = ue.exercise_id AND uv.user_id = $2
           WHERE ue.user_id = $1 AND ($3::BIGINT IS NULL OR ue.deck_id = $3)
           ORDER BY ue.created_at ASC`,
          [req.userId, req.userId, hasDeckFilter ? deckId : null]
        )
      : await db.query(
          `SELECT
             ue.id,
             ue.exercise_id,
             ue.data,
             ue.share_status,
             ue.deck_id,
             0::INT AS vote_count,
             FALSE AS user_voted
           FROM user_exercises ue
           WHERE ue.user_id = $1 AND ($2::BIGINT IS NULL OR ue.deck_id = $2)
           ORDER BY ue.created_at ASC`,
          [req.userId, hasDeckFilter ? deckId : null]
        )

    const combined = [
      ...globalResult.rows.map(
        (row: {
          id: number
          data: Record<string, unknown>
          vote_count: number
          user_voted: boolean
          deck_id: number | null
        }) => ({
        ...row.data,
        isUserAdded: false,
        voteCount: row.vote_count,
        userVoted: row.user_voted,
        ...(row.deck_id !== null ? { deckId: String(row.deck_id) } : {}),
        ...(req.userRole === 'admin' ? { adminRecordId: row.id } : {}),
      })
      ),
      ...userResult.rows.map(
        (row: {
          id: number
          data: Record<string, unknown>
          share_status: string
          vote_count: number
          user_voted: boolean
          deck_id: number | null
        }) => ({
        ...row.data,
        isUserAdded: true,
        shareStatus: row.share_status,
        voteCount: row.vote_count,
        userVoted: row.user_voted,
        ...(row.deck_id !== null ? { deckId: String(row.deck_id) } : {}),
        ...(req.userRole === 'admin' ? { adminRecordId: row.id } : {}),
      })
      ),
    ]

    res.json(mergeQuestionImages(combined, await loadQuestionImages(collectExerciseIds(combined))))
  } catch (error) {
    console.error('Failed to load exercises:', error)
    res.status(500).json({ error: 'Failed to load exercises.' })
  }
})

exercisesRouter.post('/:exerciseId/vote', requireAuth, async (req, res) => {
  const { exerciseId } = req.params
  if (!exerciseId) {
    res.status(400).json({ error: 'Exercise id is required.' })
    return
  }

  try {
    await db.query(
      `INSERT INTO exercise_votes (user_id, exercise_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, exercise_id) DO NOTHING`,
      [req.userId, exerciseId]
    )

    const countResult = await db.query(
      'SELECT COUNT(*)::INT AS vote_count FROM exercise_votes WHERE exercise_id = $1',
      [exerciseId]
    )
    res.json({ voteCount: countResult.rows[0]?.vote_count ?? 0, userVoted: true })
  } catch (error) {
    console.error('Failed to add vote:', error)
    res.status(500).json({ error: 'Failed to add vote.' })
  }
})

exercisesRouter.delete('/:exerciseId/vote', requireAuth, async (req, res) => {
  const { exerciseId } = req.params
  if (!exerciseId) {
    res.status(400).json({ error: 'Exercise id is required.' })
    return
  }

  try {
    await db.query('DELETE FROM exercise_votes WHERE user_id = $1 AND exercise_id = $2', [req.userId, exerciseId])
    const countResult = await db.query(
      'SELECT COUNT(*)::INT AS vote_count FROM exercise_votes WHERE exercise_id = $1',
      [exerciseId]
    )
    res.json({ voteCount: countResult.rows[0]?.vote_count ?? 0, userVoted: false })
  } catch (error) {
    console.error('Failed to remove vote:', error)
    res.status(500).json({ error: 'Failed to remove vote.' })
  }
})
