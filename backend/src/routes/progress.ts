import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'

export const progressRouter = Router()

interface ReviewScheduleRow {
  repetition_count: number
  interval_days: number
  ease_factor: string | number
}

function toEaseFactor(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 2.5
}

function computeNextReview(
  current: ReviewScheduleRow | null,
  correct: boolean
): { repetitionCount: number; intervalDays: number; easeFactor: number; dueAt: Date } {
  const prevRepetition = current?.repetition_count ?? 0
  const prevInterval = current?.interval_days ?? 0
  const prevEase = toEaseFactor(current?.ease_factor)

  if (!correct) {
    const easeFactor = Math.max(1.3, prevEase - 0.2)
    const repetitionCount = 0
    const intervalDays = 1
    const dueAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000)
    return { repetitionCount, intervalDays, easeFactor, dueAt }
  }

  const repetitionCount = prevRepetition + 1
  const easeFactor = Math.min(3.2, prevEase + 0.05)
  const intervalDays =
    repetitionCount === 1 ? 1 : repetitionCount === 2 ? 3 : Math.max(4, Math.round(prevInterval * easeFactor))
  const dueAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000)
  return { repetitionCount, intervalDays, easeFactor, dueAt }
}

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

progressRouter.post('/', async (req, res) => {
  const { exercise_id, correct } = req.body as { exercise_id?: unknown; correct?: unknown }

  if (typeof exercise_id !== 'string' || typeof correct !== 'boolean') {
    res.status(400).json({ error: 'exercise_id (string) and correct (boolean) are required' })
    return
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO progress (exercise_id, correct, user_id) VALUES ($1, $2, $3)',
      [exercise_id, correct, req.userId]
    )
    const scheduleResult = await client.query<ReviewScheduleRow>(
      `SELECT repetition_count, interval_days, ease_factor
       FROM user_review_schedule
       WHERE user_id = $1 AND exercise_id = $2`,
      [req.userId, exercise_id]
    )
    const currentSchedule = scheduleResult.rows[0] ?? null
    const nextReview = computeNextReview(currentSchedule, correct)

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
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, NOW())
       ON CONFLICT (user_id, exercise_id)
       DO UPDATE SET
         repetition_count = EXCLUDED.repetition_count,
         interval_days = EXCLUDED.interval_days,
         ease_factor = EXCLUDED.ease_factor,
         due_at = EXCLUDED.due_at,
         last_reviewed_at = NOW(),
         last_outcome_correct = EXCLUDED.last_outcome_correct,
         updated_at = NOW()`,
      [
        req.userId,
        exercise_id,
        nextReview.repetitionCount,
        nextReview.intervalDays,
        nextReview.easeFactor,
        nextReview.dueAt,
        correct,
      ]
    )
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
