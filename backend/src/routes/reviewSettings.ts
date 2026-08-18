import { Router } from 'express'
import { requireAuth } from '../auth/middleware'
import { db } from '../db/database'
import {
  DEFAULT_INTERVAL_MULTIPLIER,
  MAX_INTERVAL_MULTIPLIER,
  MIN_INTERVAL_MULTIPLIER,
  isValidIntervalMultiplier,
} from '../services/reviewScheduler'

export const reviewSettingsRouter = Router()

reviewSettingsRouter.use(requireAuth)

reviewSettingsRouter.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT interval_multiplier FROM user_review_settings WHERE user_id = $1`,
      [req.userId]
    )
    const row = result.rows[0] as { interval_multiplier: string | number } | undefined
    res.json({
      interval_multiplier: row ? Number(row.interval_multiplier) : DEFAULT_INTERVAL_MULTIPLIER,
      min_interval_multiplier: MIN_INTERVAL_MULTIPLIER,
      max_interval_multiplier: MAX_INTERVAL_MULTIPLIER,
    })
  } catch (error) {
    console.error('Failed to load review settings:', error)
    res.status(500).json({ error: 'Failed to load review settings.' })
  }
})

reviewSettingsRouter.put('/', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const intervalMultiplier = body.interval_multiplier

  if (!isValidIntervalMultiplier(intervalMultiplier)) {
    res.status(400).json({
      error: `interval_multiplier must be a number between ${MIN_INTERVAL_MULTIPLIER} and ${MAX_INTERVAL_MULTIPLIER}.`,
    })
    return
  }

  try {
    await db.query(
      `INSERT INTO user_review_settings (user_id, interval_multiplier, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET interval_multiplier = EXCLUDED.interval_multiplier, updated_at = NOW()`,
      [req.userId, intervalMultiplier]
    )
    res.json({ interval_multiplier: intervalMultiplier })
  } catch (error) {
    console.error('Failed to save review settings:', error)
    res.status(500).json({ error: 'Failed to save review settings.' })
  }
})
