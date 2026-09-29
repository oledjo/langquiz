import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { parseDeckIdParam } from './queryParams'
import { pausedDeckSql } from './pausedDecks'

export const statsRouter = Router()

statsRouter.use(requireAuth)

export const RECENT_RESULTS_LIMIT = 10

// A question from a deck the user stopped learning is never due: its schedule is kept (so
// resuming continues where it left off) but reported as unscheduled, which drops it from every
// due list while its answer statistics stay intact.
const DUE_AT_SQL = `(CASE WHEN ${pausedDeckSql('es.user_id')} THEN NULL ELSE urs.due_at END)`

export interface RecentResultsRow {
  exercise_id: string
  recent: boolean[] | null
}

/** Adds `recent` (last answers, oldest first) to each stats row; rows without history get []. */
export function attachRecentResults<T extends { exercise_id: string }>(
  rows: T[],
  recentRows: RecentResultsRow[]
): (T & { recent: boolean[] })[] {
  const byExercise = new Map(recentRows.map((row) => [row.exercise_id, row.recent ?? []]))
  return rows.map((row) => ({ ...row, recent: byExercise.get(row.exercise_id) ?? [] }))
}

statsRouter.get('/', async (req, res) => {
  try {
    const deckId = parseDeckIdParam(req.query.deckId)

    const [result, recent] = await Promise.all([
      db.query(
      `SELECT
         es.exercise_id,
         es.total_attempts,
         es.correct_attempts,
         es.last_answered,
         ${DUE_AT_SQL} AS due_at,
         urs.repetition_count,
         urs.interval_days,
         urs.scheduler_version,
         urs.lapse_count,
         urs.last_answer_grade,
         COALESCE(e.deck_id, ue.deck_id)::TEXT AS deck_id
       FROM exercise_stats es
       LEFT JOIN user_review_schedule urs
         ON urs.user_id = es.user_id
        AND urs.exercise_id = es.exercise_id
       LEFT JOIN exercises e ON e.exercise_id = es.exercise_id
       LEFT JOIN user_exercises ue ON ue.exercise_id = es.exercise_id AND ue.user_id = es.user_id
       WHERE es.user_id = $1
         AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)
       ORDER BY
         CASE WHEN ${DUE_AT_SQL} IS NOT NULL AND ${DUE_AT_SQL} <= NOW() THEN 0 ELSE 1 END,
         ${DUE_AT_SQL} ASC NULLS LAST,
         es.last_answered DESC NULLS LAST`,
      [req.userId, deckId]
      ),
      db.query<RecentResultsRow>(
        `SELECT exercise_id, array_agg(correct ORDER BY answered_at ASC, id ASC) AS recent
         FROM (
           SELECT exercise_id, correct, answered_at, id,
                  ROW_NUMBER() OVER (PARTITION BY exercise_id ORDER BY answered_at DESC, id DESC) AS rn
           FROM progress
           WHERE user_id = $1
         ) ranked
         WHERE rn <= $2
         GROUP BY exercise_id`,
        [req.userId, RECENT_RESULTS_LIMIT]
      ),
    ])
    res.json(attachRecentResults(result.rows as { exercise_id: string }[], recent.rows))
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})

statsRouter.get('/:exerciseId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         es.exercise_id,
         es.total_attempts,
         es.correct_attempts,
         es.last_answered,
         ${DUE_AT_SQL} AS due_at,
         urs.repetition_count,
         urs.interval_days,
         urs.scheduler_version,
         urs.lapse_count,
         urs.last_answer_grade
       FROM exercise_stats es
       LEFT JOIN user_review_schedule urs
         ON urs.user_id = es.user_id
        AND urs.exercise_id = es.exercise_id
       LEFT JOIN exercises e ON e.exercise_id = es.exercise_id
       LEFT JOIN user_exercises ue ON ue.exercise_id = es.exercise_id AND ue.user_id = es.user_id
       WHERE es.user_id = $1 AND es.exercise_id = $2`,
      [req.userId, req.params.exerciseId]
    )

    res.json(
      result.rows[0] ?? {
        exercise_id: req.params.exerciseId,
        total_attempts: 0,
        correct_attempts: 0,
        last_answered: null,
        due_at: null,
        repetition_count: 0,
        interval_days: 0,
        scheduler_version: null,
        lapse_count: 0,
        last_answer_grade: null,
      }
    )
  } catch (error) {
    console.error('Failed to fetch exercise stats:', error)
    res.status(500).json({ error: 'Failed to load exercise stats' })
  }
})
