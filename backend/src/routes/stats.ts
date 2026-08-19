import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { parseDeckIdParam } from './queryParams'

export const statsRouter = Router()

statsRouter.use(requireAuth)

statsRouter.get('/', async (req, res) => {
  try {
    const deckId = parseDeckIdParam(req.query.deckId)

    const result = await db.query(
      `SELECT
         es.exercise_id,
         es.total_attempts,
         es.correct_attempts,
         es.last_answered,
         urs.due_at,
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
       WHERE es.user_id = $1
         AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)
       ORDER BY
         CASE WHEN urs.due_at IS NOT NULL AND urs.due_at <= NOW() THEN 0 ELSE 1 END,
         urs.due_at ASC NULLS LAST,
         es.last_answered DESC NULLS LAST`,
      [req.userId, deckId]
    )
    res.json(result.rows)
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
         urs.due_at,
         urs.repetition_count,
         urs.interval_days,
         urs.scheduler_version,
         urs.lapse_count,
         urs.last_answer_grade
       FROM exercise_stats es
       LEFT JOIN user_review_schedule urs
         ON urs.user_id = es.user_id
        AND urs.exercise_id = es.exercise_id
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
