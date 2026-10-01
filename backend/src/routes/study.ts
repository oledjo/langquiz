import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'

export const studyRouter = Router()

studyRouter.use(requireAuth)

export const DEFAULT_DAILY_REVIEW_LIMIT = 200
export const DEFAULT_DAILY_NEW_LIMIT = 20
const MAX_DAILY_REVIEW_LIMIT = 9999
const MAX_DAILY_NEW_LIMIT = 999

export interface StudySettings {
  dailyReviewLimit: number
  dailyNewLimit: number
}

export interface StudyToday extends StudySettings {
  /** Calendar day in the caller's time zone, YYYY-MM-DD. */
  day: string
  /** Questions answered today that had been answered before today (outside exams). */
  reviewedToday: number
  /** Questions answered for the first time today (outside exams). */
  newToday: number
  reviewsRemaining: number
  newRemaining: number
}

/** An IANA zone name ("Europe/Berlin", "UTC"). Postgres has the final say; this keeps junk out. */
export function parseTimeZone(raw: unknown): string | null {
  if (raw === undefined) return 'UTC'
  if (typeof raw !== 'string' || raw.length > 64 || !/^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*$/.test(raw)) {
    return null
  }
  return raw
}

export function parseSettingsBody(body: unknown): StudySettings | { error: string } {
  const { dailyReviewLimit, dailyNewLimit } = (body ?? {}) as Record<string, unknown>
  if (!Number.isInteger(dailyReviewLimit) || (dailyReviewLimit as number) < 0 || (dailyReviewLimit as number) > MAX_DAILY_REVIEW_LIMIT) {
    return { error: `dailyReviewLimit must be an integer between 0 and ${MAX_DAILY_REVIEW_LIMIT}` }
  }
  if (!Number.isInteger(dailyNewLimit) || (dailyNewLimit as number) < 0 || (dailyNewLimit as number) > MAX_DAILY_NEW_LIMIT) {
    return { error: `dailyNewLimit must be an integer between 0 and ${MAX_DAILY_NEW_LIMIT}` }
  }
  return { dailyReviewLimit: dailyReviewLimit as number, dailyNewLimit: dailyNewLimit as number }
}

export function buildStudyToday(
  settings: StudySettings,
  counts: { day: string; reviewed_today: number; new_today: number }
): StudyToday {
  return {
    ...settings,
    day: counts.day,
    reviewedToday: counts.reviewed_today,
    newToday: counts.new_today,
    reviewsRemaining: Math.max(0, settings.dailyReviewLimit - counts.reviewed_today),
    newRemaining: Math.max(0, settings.dailyNewLimit - counts.new_today),
  }
}

async function loadSettings(userId: number): Promise<StudySettings> {
  const result = await db.query<{ daily_review_limit: number; daily_new_limit: number }>(
    'SELECT daily_review_limit, daily_new_limit FROM user_study_settings WHERE user_id = $1',
    [userId]
  )
  const row = result.rows[0]
  return {
    dailyReviewLimit: row?.daily_review_limit ?? DEFAULT_DAILY_REVIEW_LIMIT,
    dailyNewLimit: row?.daily_new_limit ?? DEFAULT_DAILY_NEW_LIMIT,
  }
}

/**
 * Today's review/new counts. A question counts once per day however often it was answered; it is
 * "new" if its first answer outside an exam was today, a "review" otherwise.
 */
async function loadTodayCounts(userId: number, timeZone: string) {
  const result = await db.query<{ day: string; reviewed_today: number; new_today: number }>(
    `WITH bounds AS (
       SELECT date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2 AS day_start,
              to_char(NOW() AT TIME ZONE $2, 'YYYY-MM-DD') AS day
     ),
     studied AS (
       SELECT exercise_id, MIN(answered_at) AS first_at, MAX(answered_at) AS last_at
       FROM progress
       WHERE user_id = $1 AND COALESCE(mode, 'practice') <> 'exam'
       GROUP BY exercise_id
     )
     SELECT b.day,
            COUNT(s.exercise_id) FILTER (WHERE s.last_at >= b.day_start AND s.first_at < b.day_start)::INT AS reviewed_today,
            COUNT(s.exercise_id) FILTER (WHERE s.first_at >= b.day_start)::INT AS new_today
     FROM bounds b LEFT JOIN studied s ON s.last_at >= b.day_start
     GROUP BY b.day`,
    [userId, timeZone]
  )
  return result.rows[0]
}

function isBadTimeZoneError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '22023'
}

studyRouter.get('/today', async (req, res) => {
  const timeZone = parseTimeZone(req.query.tz)
  if (!timeZone) {
    res.status(400).json({ error: 'tz must be an IANA time zone name' })
    return
  }
  try {
    const [settings, counts] = await Promise.all([loadSettings(req.userId!), loadTodayCounts(req.userId!, timeZone)])
    res.json(buildStudyToday(settings, counts))
  } catch (error) {
    if (isBadTimeZoneError(error)) {
      res.status(400).json({ error: 'Unknown time zone' })
      return
    }
    console.error('Failed to load study day:', error)
    res.status(500).json({ error: 'Failed to load today’s study limits' })
  }
})

studyRouter.put('/settings', async (req, res) => {
  const parsed = parseSettingsBody(req.body)
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  try {
    await db.query(
      `INSERT INTO user_study_settings (user_id, daily_review_limit, daily_new_limit, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         daily_review_limit = EXCLUDED.daily_review_limit,
         daily_new_limit = EXCLUDED.daily_new_limit,
         updated_at = NOW()`,
      [req.userId, parsed.dailyReviewLimit, parsed.dailyNewLimit]
    )
    res.json(parsed)
  } catch (error) {
    console.error('Failed to save study settings:', error)
    res.status(500).json({ error: 'Failed to save study settings' })
  }
})
