import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'

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

progressRouter.post('/', async (req, res) => {
  const { exercise_id, correct } = req.body as { exercise_id?: unknown; correct?: unknown }

  if (typeof exercise_id !== 'string' || typeof correct !== 'boolean') {
    res.status(400).json({ error: 'exercise_id (string) and correct (boolean) are required' })
    return
  }

  try {
    await db.query(
      'INSERT INTO progress (exercise_id, correct, user_id) VALUES ($1, $2, $3)',
      [exercise_id, correct, req.userId]
    )
  } catch (error) {
    console.error('Failed to insert progress row:', error)
    res.status(500).json({ error: 'Failed to save progress' })
    return
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
