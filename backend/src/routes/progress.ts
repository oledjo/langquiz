import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { parseDeckIdParam } from './queryParams'
import { isAnswerGrade, type AnswerGrade } from '../services/reviewScheduler'
import { applyProgressEvent, type ProgressEventStatus } from '../services/applyProgressEvent'

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

const INTERVAL_BUCKET_EDGES = [3, 7, 21, 60, 180]

function bucketIntervals(intervalDays: number[]): { label: string; count: number }[] {
  const buckets = INTERVAL_BUCKET_EDGES.map((edge, i) => ({
    label: i === 0 ? `0-${edge}` : `${INTERVAL_BUCKET_EDGES[i - 1]}-${edge}`,
    min: i === 0 ? 0 : INTERVAL_BUCKET_EDGES[i - 1],
    max: edge,
    count: 0,
  }))
  buckets.push({ label: `${INTERVAL_BUCKET_EDGES[INTERVAL_BUCKET_EDGES.length - 1]}+`, min: Infinity, max: Infinity, count: 0 })
  const lastIndex = buckets.length - 1

  for (const days of intervalDays) {
    const index = buckets.findIndex((bucket, i) => i === lastIndex || days < bucket.max)
    buckets[Math.max(index, 0)].count += 1
  }

  return buckets.map(({ label, count }) => ({ label, count }))
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

progressRouter.get('/statistics', async (req, res) => {
  try {
    const deckId = parseDeckIdParam(req.query.deckId)

    const [activityResult, futureDueAggResult, futureDueForecastResult, intervalsResult, cardCountsResult] = await Promise.all([
      db.query(
        `WITH scoped_progress AS (
           SELECT p.answered_at, p.answer_grade, p.correct
           FROM progress p
           LEFT JOIN exercises e ON e.exercise_id = p.exercise_id
           LEFT JOIN user_exercises ue ON ue.exercise_id = p.exercise_id AND ue.user_id = p.user_id
           WHERE p.user_id = $1
             AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)
         )
         SELECT
           to_char(day_bucket, 'YYYY-MM-DD') AS day,
           COUNT(*) FILTER (WHERE sp.answer_grade = 'again')::INT AS again,
           COUNT(*) FILTER (WHERE sp.answer_grade = 'hard')::INT AS hard,
           COUNT(*) FILTER (WHERE sp.answer_grade = 'good' OR (sp.answer_grade IS NULL AND sp.correct))::INT AS good,
           COUNT(*) FILTER (WHERE sp.answer_grade = 'easy')::INT AS easy
         FROM generate_series(
           (CURRENT_DATE - INTERVAL '364 days')::TIMESTAMP,
           CURRENT_DATE::TIMESTAMP,
           INTERVAL '1 day'
         ) AS day_bucket
         LEFT JOIN scoped_progress sp
           ON sp.answered_at >= day_bucket AND sp.answered_at < day_bucket + INTERVAL '1 day'
         GROUP BY day_bucket
         ORDER BY day_bucket ASC`,
        [req.userId, deckId]
      ),
      db.query(
        `WITH scoped_schedule AS (
           SELECT urs.due_at
           FROM user_review_schedule urs
           LEFT JOIN exercises e ON e.exercise_id = urs.exercise_id
           LEFT JOIN user_exercises ue ON ue.exercise_id = urs.exercise_id AND ue.user_id = urs.user_id
           WHERE urs.user_id = $1
             AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)
         )
         SELECT
           COUNT(*) FILTER (WHERE due_at::date < CURRENT_DATE)::INT AS backlog,
           COUNT(*) FILTER (WHERE due_at::date = CURRENT_DATE + 1)::INT AS due_tomorrow
         FROM scoped_schedule`,
        [req.userId, deckId]
      ),
      db.query(
        `WITH scoped_schedule AS (
           SELECT urs.due_at
           FROM user_review_schedule urs
           LEFT JOIN exercises e ON e.exercise_id = urs.exercise_id
           LEFT JOIN user_exercises ue ON ue.exercise_id = urs.exercise_id AND ue.user_id = urs.user_id
           WHERE urs.user_id = $1
             AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)
         )
         SELECT
           to_char(day_bucket, 'YYYY-MM-DD') AS day,
           COUNT(ss.due_at)::INT AS count
         FROM generate_series(
           CURRENT_DATE::TIMESTAMP,
           (CURRENT_DATE + INTERVAL '89 days')::TIMESTAMP,
           INTERVAL '1 day'
         ) AS day_bucket
         LEFT JOIN scoped_schedule ss ON ss.due_at::date = day_bucket::date
         GROUP BY day_bucket
         ORDER BY day_bucket ASC`,
        [req.userId, deckId]
      ),
      db.query(
        `SELECT urs.interval_days
         FROM user_review_schedule urs
         LEFT JOIN exercises e ON e.exercise_id = urs.exercise_id
         LEFT JOIN user_exercises ue ON ue.exercise_id = urs.exercise_id AND ue.user_id = urs.user_id
         WHERE urs.user_id = $1
           AND urs.repetition_count > 0
           AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)`,
        [req.userId, deckId]
      ),
      db.query(
        `WITH deck_exercises AS (
           SELECT exercise_id FROM exercises WHERE ($1::BIGINT IS NULL OR deck_id = $1)
           UNION
           SELECT exercise_id FROM user_exercises WHERE user_id = $2 AND ($1::BIGINT IS NULL OR deck_id = $1)
         )
         SELECT
           COUNT(*) FILTER (WHERE urs.exercise_id IS NULL)::INT AS new_count,
           COUNT(*) FILTER (WHERE urs.exercise_id IS NOT NULL AND urs.interval_days < 21)::INT AS young_count,
           COUNT(*) FILTER (WHERE urs.exercise_id IS NOT NULL AND urs.interval_days >= 21)::INT AS mature_count
         FROM deck_exercises de
         LEFT JOIN user_review_schedule urs ON urs.exercise_id = de.exercise_id AND urs.user_id = $2`,
        [deckId, req.userId]
      ),
    ])

    const activity = activityResult.rows as Array<{ day: string; again: number; hard: number; good: number; easy: number }>
    const today = activity[activity.length - 1] ?? { again: 0, hard: 0, good: 0, easy: 0 }
    const todayTotal = today.again + today.hard + today.good + today.easy
    const todayCorrect = today.hard + today.good + today.easy

    const daysWithActivity = activity.filter((day) => day.again + day.hard + day.good + day.easy > 0).length
    const last30 = activity.slice(-30)
    const totalReviews30 = last30.reduce((sum, day) => sum + day.again + day.hard + day.good + day.easy, 0)
    const daysStudied30 = last30.filter((day) => day.again + day.hard + day.good + day.easy > 0).length

    const futureAgg = futureDueAggResult.rows[0] as { backlog: number; due_tomorrow: number }
    const forecast = futureDueForecastResult.rows as Array<{ day: string; count: number }>
    const forecastTotal = forecast.reduce((sum, day) => sum + day.count, 0)

    const intervalDays = (intervalsResult.rows as Array<{ interval_days: number }>).map((row) => row.interval_days)
    const cardCounts = cardCountsResult.rows[0] as {
      new_count: number
      young_count: number
      mature_count: number
    }

    res.json({
      today: { total: todayTotal, correct: todayCorrect },
      activity,
      daysWithActivity,
      reviews: {
        last30,
        totalReviews: totalReviews30,
        daysStudied: daysStudied30,
        daysInRange: last30.length,
        averagePerDay: last30.length > 0 ? totalReviews30 / last30.length : 0,
      },
      futureDue: {
        backlog: futureAgg?.backlog ?? 0,
        dueTomorrow: futureAgg?.due_tomorrow ?? 0,
        forecast,
        total: forecastTotal,
        averagePerDay: forecast.length > 0 ? forecastTotal / forecast.length : 0,
      },
      cardCounts: {
        new: cardCounts?.new_count ?? 0,
        young: cardCounts?.young_count ?? 0,
        mature: cardCounts?.mature_count ?? 0,
      },
      reviewIntervals: {
        buckets: bucketIntervals(intervalDays),
        median: median(intervalDays),
      },
    })
  } catch (error) {
    console.error('Failed to fetch statistics:', error)
    res.status(500).json({ error: 'Failed to load statistics' })
  }
})

export function isValidProgressMode(value: unknown): value is 'practice' | 'exam' | undefined {
  return value === undefined || value === 'practice' || value === 'exam'
}

export interface BatchItemInput {
  clientId: string
  exercise_id: string
  correct: boolean
  answer_grade: AnswerGrade
  mode: 'practice' | 'exam'
}

export function parseBatchItems(body: unknown): { items: BatchItemInput[] } | { error: string } {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { items?: unknown }).items)) {
    return { error: 'body.items must be an array' }
  }
  const raw = (body as { items: unknown[] }).items
  if (raw.length === 0) return { error: 'body.items must not be empty' }
  if (raw.length > 200) return { error: 'body.items must not exceed 200 entries' }

  const items: BatchItemInput[] = []
  for (const entry of raw) {
    const e = entry as Record<string, unknown>
    if (typeof e.clientId !== 'string' || e.clientId.trim() === '') return { error: 'each item needs a non-empty clientId' }
    if (typeof e.exercise_id !== 'string' || e.exercise_id.trim() === '') return { error: 'each item needs an exercise_id' }
    if (typeof e.correct !== 'boolean') return { error: 'each item needs a boolean correct' }
    if (!isAnswerGrade(e.answer_grade)) return { error: 'answer_grade must be again|hard|good|easy' }
    const mode = e.mode ?? 'practice'
    if (mode !== 'practice' && mode !== 'exam') return { error: 'mode must be practice|exam' }
    const grade = e.answer_grade as AnswerGrade
    if (grade === 'again' && e.correct) return { error: 'answer_grade "again" is not compatible with correct=true' }
    if (grade !== 'again' && !e.correct) return { error: `answer_grade "${grade}" is not compatible with correct=false` }
    items.push({ clientId: e.clientId, exercise_id: e.exercise_id, correct: e.correct, answer_grade: grade, mode })
  }
  return { items }
}

export function parseSince(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return null
  return raw
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

    const status = await applyProgressEvent(client, {
      userId: req.userId!,
      exerciseId: exercise_id,
      correct,
      grade,
      mode: progressMode,
      idempotencyKey,
    })
    await client.query('COMMIT')

    if (status === 'conflict') {
      res.status(409).json({
        error: 'Idempotency key has already been used with a different payload',
        requestId: req.requestId ?? null,
      })
      return
    }
    if (status === 'duplicate') {
      res.status(200).json({ ok: true, duplicate: true })
      return
    }
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

progressRouter.post('/batch', async (req, res) => {
  const parsed = parseBatchItems(req.body)
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }

  const client = await db.connect()
  const results: { clientId: string; status: ProgressEventStatus }[] = []
  try {
    await client.query('BEGIN')
    for (const item of parsed.items) {
      const status = await applyProgressEvent(client, {
        userId: req.userId!,
        exerciseId: item.exercise_id,
        correct: item.correct,
        grade: item.answer_grade,
        mode: item.mode,
        idempotencyKey: item.clientId,
      })
      results.push({ clientId: item.clientId, status })
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to apply progress batch:', error)
    res.status(500).json({ error: 'Failed to apply progress batch' })
    return
  } finally {
    client.release()
  }
  res.json({ results })
})

progressRouter.get('/schedule', async (req, res) => {
  try {
    const since = parseSince(req.query.since)
    const deckId = parseDeckIdParam(req.query.deckId)
    const rowsResult = await db.query(
      `SELECT
         urs.exercise_id AS "exerciseId",
         to_char(urs.due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "dueAt",
         urs.interval_days AS "intervalDays",
         urs.repetition_count AS "repetitionCount",
         urs.lapse_count AS "lapseCount",
         urs.last_answer_grade AS "lastAnswerGrade"
       FROM user_review_schedule urs
       LEFT JOIN exercises e ON e.exercise_id = urs.exercise_id
       LEFT JOIN user_exercises ue ON ue.exercise_id = urs.exercise_id AND ue.user_id = urs.user_id
       WHERE urs.user_id = $1
         AND ($2::TIMESTAMPTZ IS NULL OR urs.updated_at > $2)
         AND ($3::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $3)
       ORDER BY urs.updated_at ASC`,
      [req.userId, since, deckId]
    )
    res.json({ syncedAt: new Date().toISOString(), rows: rowsResult.rows })
  } catch (error) {
    console.error('Failed to load schedule:', error)
    res.status(500).json({ error: 'Failed to load schedule' })
  }
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
