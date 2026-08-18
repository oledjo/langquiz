import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { parseDeckIdParam } from './queryParams'
import {
  computeNextReview,
  isAnswerGrade,
  DEFAULT_INTERVAL_MULTIPLIER,
  type AnswerGrade,
  type ReviewScheduleState,
} from '../services/reviewScheduler'

export const progressRouter = Router()

progressRouter.use(requireAuth)

progressRouter.get('/summary', async (req, res) => {
  try {
    const summaryResult = await db.query(
      `
        SELECT
          COALESCE((SELECT COUNT(*)::INT
           FROM progress p
           WHERE p.user_id = $1
             AND p.answered_at >= CURRENT_DATE), 0)::INT AS day_total,

          COALESCE((SELECT COUNT(*)::INT
           FROM progress p
           WHERE p.user_id = $1
             AND p.answered_at >= NOW() - INTERVAL '7 days'), 0)::INT AS week_total,

          COALESCE((SELECT COUNT(*)::INT
           FROM progress p
           WHERE p.user_id = $1
             AND p.answered_at >= NOW() - INTERVAL '30 days'), 0)::INT AS month_total,

          COALESCE((SELECT SUM(CASE WHEN p.correct THEN 1 ELSE 0 END)::INT
           FROM progress p
           WHERE p.user_id = $1
             AND p.answered_at >= CURRENT_DATE), 0)::INT AS day_correct,

          COALESCE((SELECT SUM(CASE WHEN p.correct THEN 1 ELSE 0 END)::INT
           FROM progress p
           WHERE p.user_id = $1
             AND p.answered_at >= NOW() - INTERVAL '7 days'), 0)::INT AS week_correct,

          COALESCE((SELECT SUM(CASE WHEN p.correct THEN 1 ELSE 0 END)::INT
           FROM progress p
           WHERE p.user_id = $1
             AND p.answered_at >= NOW() - INTERVAL '30 days'), 0)::INT AS month_correct
      `,
      [req.userId]
    )

    const barsResult = await db.query(
      `
        SELECT
          to_char(day_bucket, 'YYYY-MM-DD') AS day,
          COALESCE(COUNT(p.exercise_id), 0)::INT AS total,
          COALESCE(SUM(CASE WHEN p.correct THEN 1 ELSE 0 END), 0)::INT AS correct
        FROM generate_series(
          (CURRENT_DATE - INTERVAL '13 days')::TIMESTAMP,
          CURRENT_DATE::TIMESTAMP,
          INTERVAL '1 day'
        ) AS day_bucket
        LEFT JOIN progress p
          ON p.user_id = $1
         AND p.answered_at >= day_bucket
         AND p.answered_at < (day_bucket + INTERVAL '1 day')
        GROUP BY day_bucket
        ORDER BY day_bucket ASC
      `,
      [req.userId]
    )

    const row = summaryResult.rows[0] as {
      day_total: number | null
      week_total: number | null
      month_total: number | null
      day_correct: number | null
      week_correct: number | null
      month_correct: number | null
    }

    res.json({
      day: { total: row?.day_total ?? 0, correct: row?.day_correct ?? 0 },
      week: { total: row?.week_total ?? 0, correct: row?.week_correct ?? 0 },
      month: { total: row?.month_total ?? 0, correct: row?.month_correct ?? 0 },
      bars: barsResult.rows as Array<{ day: string; total: number; correct: number }>,
    })
  } catch (error) {
    console.error('Failed to fetch progress summary:', error)
    res.status(500).json({ error: 'Failed to load progress summary' })
  }
})

progressRouter.get('/review-metrics', async (req, res) => {
  try {
    const deckId = parseDeckIdParam(req.query.deckId)

    const result = await db.query(
      `SELECT
         COUNT(*)::INT AS scheduled_total,
         COUNT(*) FILTER (WHERE due_at <= NOW())::INT AS due_now,
         COUNT(*) FILTER (WHERE due_at < NOW() - INTERVAL '1 day')::INT AS overdue,
         COUNT(*) FILTER (WHERE due_at > NOW() AND due_at <= NOW() + INTERVAL '7 days')::INT AS due_next_7_days,
         COALESCE(SUM(urs.lapse_count), 0)::INT AS total_lapses,
         COUNT(*) FILTER (WHERE urs.last_answer_grade = 'again')::INT AS last_review_failed,
         urs.scheduler_version
       FROM user_review_schedule urs
       LEFT JOIN exercises e ON e.exercise_id = urs.exercise_id
       LEFT JOIN user_exercises ue ON ue.exercise_id = urs.exercise_id AND ue.user_id = urs.user_id
       WHERE urs.user_id = $1
         AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)
       GROUP BY urs.scheduler_version
       ORDER BY urs.scheduler_version ASC`,
      [req.userId, deckId]
    )

    const totals = result.rows.reduce(
      (acc, row: {
        scheduled_total: number
        due_now: number
        overdue: number
        due_next_7_days: number
        total_lapses: number
        last_review_failed: number
      }) => ({
        scheduled_total: acc.scheduled_total + row.scheduled_total,
        due_now: acc.due_now + row.due_now,
        overdue: acc.overdue + row.overdue,
        due_next_7_days: acc.due_next_7_days + row.due_next_7_days,
        total_lapses: acc.total_lapses + row.total_lapses,
        last_review_failed: acc.last_review_failed + row.last_review_failed,
      }),
      {
        scheduled_total: 0,
        due_now: 0,
        overdue: 0,
        due_next_7_days: 0,
        total_lapses: 0,
        last_review_failed: 0,
      }
    )

    res.json({ totals, bySchedulerVersion: result.rows })
  } catch (error) {
    console.error('Failed to fetch review metrics:', error)
    res.status(500).json({ error: 'Failed to load review metrics' })
  }
})

export function isValidProgressMode(value: unknown): value is 'practice' | 'exam' | undefined {
  return value === undefined || value === 'practice' || value === 'exam'
}

progressRouter.post('/', async (req, res) => {
  const { exercise_id, correct, answer_grade, mode } = req.body as {
    exercise_id?: unknown
    correct?: unknown
    answer_grade?: unknown
    mode?: unknown
  }

  if (typeof exercise_id !== 'string' || typeof correct !== 'boolean') {
    res.status(400).json({ error: 'exercise_id (string) and correct (boolean) are required' })
    return
  }

  if (answer_grade !== undefined && !isAnswerGrade(answer_grade)) {
    res.status(400).json({ error: 'answer_grade must be one of: again, hard, good, easy' })
    return
  }

  if (!isValidProgressMode(mode)) {
    res.status(400).json({ error: 'mode must be one of: practice, exam' })
    return
  }

  const progressMode: 'practice' | 'exam' = mode ?? 'practice'

  const grade: AnswerGrade = answer_grade ?? (correct ? 'good' : 'again')
  if (grade === 'again' && correct) {
    res.status(400).json({ error: 'answer_grade "again" is not compatible with correct=true' })
    return
  }
  if (grade !== 'again' && !correct) {
    res.status(400).json({ error: `answer_grade "${grade}" is not compatible with correct=false` })
    return
  }

  const rawIdempotencyKey = req.header('idempotency-key')
  const idempotencyKey = rawIdempotencyKey?.trim() || null

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    if (idempotencyKey) {
      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO progress (exercise_id, correct, user_id, idempotency_key, answer_grade)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, idempotency_key)
         DO NOTHING
         RETURNING id`,
        [exercise_id, correct, req.userId, idempotencyKey, grade]
      )

      if ((insertResult.rowCount ?? 0) === 0) {
        const existingResult = await client.query<{ exercise_id: string; correct: boolean; answer_grade: string | null }>(
          `SELECT exercise_id, correct, answer_grade
           FROM progress
           WHERE user_id = $1 AND idempotency_key = $2
           ORDER BY id DESC
           LIMIT 1`,
          [req.userId, idempotencyKey]
        )

        await client.query('COMMIT')

        const existing = existingResult.rows[0]
        if (
          existing &&
          (existing.exercise_id !== exercise_id || existing.correct !== correct || (existing.answer_grade ?? null) !== grade)
        ) {
          res.status(409).json({
            error: 'Idempotency key has already been used with a different payload',
            requestId: req.requestId ?? null,
          })
          return
        }

        res.status(200).json({ ok: true, duplicate: true })
        return
      }
    } else {
      await client.query(
        'INSERT INTO progress (exercise_id, correct, user_id, answer_grade) VALUES ($1, $2, $3, $4)',
        [exercise_id, correct, req.userId, grade]
      )
    }

    if (progressMode !== 'exam') {
      const [scheduleResult, settingsResult] = await Promise.all([
        client.query<ReviewScheduleState>(
          `SELECT repetition_count, interval_days, ease_factor, lapse_count
           FROM user_review_schedule
           WHERE user_id = $1 AND exercise_id = $2`,
          [req.userId, exercise_id]
        ),
        client.query<{ interval_multiplier: string | number }>(
          `SELECT interval_multiplier FROM user_review_settings WHERE user_id = $1`,
          [req.userId]
        ),
      ])
      const currentSchedule = scheduleResult.rows[0] ?? null
      const intervalMultiplier = settingsResult.rows[0]
        ? Number(settingsResult.rows[0].interval_multiplier)
        : DEFAULT_INTERVAL_MULTIPLIER
      const nextReview = computeNextReview(currentSchedule, grade, new Date(), intervalMultiplier)

      await client.query(
        `INSERT INTO user_review_schedule (
           user_id,
           exercise_id,
           repetition_count,
           interval_days,
           ease_factor,
           due_at,
           last_reviewed_at,
           last_outcome_correct,
           scheduler_version,
           lapse_count,
           last_answer_grade,
           updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, NOW())
         ON CONFLICT (user_id, exercise_id)
         DO UPDATE SET
           repetition_count = EXCLUDED.repetition_count,
           interval_days = EXCLUDED.interval_days,
           ease_factor = EXCLUDED.ease_factor,
           due_at = EXCLUDED.due_at,
           last_reviewed_at = NOW(),
           last_outcome_correct = EXCLUDED.last_outcome_correct,
           scheduler_version = EXCLUDED.scheduler_version,
           lapse_count = EXCLUDED.lapse_count,
           last_answer_grade = EXCLUDED.last_answer_grade,
           updated_at = NOW()`,
        [
          req.userId,
          exercise_id,
          nextReview.repetitionCount,
          nextReview.intervalDays,
          nextReview.easeFactor,
          nextReview.dueAt,
          correct,
          nextReview.schedulerVersion,
          nextReview.lapseCount,
          grade,
        ]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to insert progress row:', error)
    res.status(500).json({ error: 'Failed to save progress' })
    return
  } finally {
    client.release()
  }

  res.status(201).json({ ok: true })
})

progressRouter.get('/:exerciseId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT exercise_id, correct, answered_at FROM progress WHERE exercise_id = $1 AND user_id = $2 ORDER BY answered_at DESC',
      [req.params.exerciseId, req.userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Failed to fetch progress rows:', error)
    res.status(500).json({ error: 'Failed to load progress' })
  }
})
