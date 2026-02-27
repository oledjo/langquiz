import { Router } from 'express'
import { requireAuth } from '../auth/middleware'
import { db } from '../db/database'
import { verifyUnsubscribeToken } from '../services/email'
import { runRetentionAutomation } from '../services/retention'

export const retentionRouter = Router()
const CRON_SECRET = process.env.CRON_SECRET ?? process.env.RETENTION_CRON_SECRET ?? ''

retentionRouter.get('/unsubscribe', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!token) {
    res.status(400).send('<h1>Invalid unsubscribe link</h1>')
    return
  }

  try {
    const payload = verifyUnsubscribeToken(token)
    await db.query(
      `INSERT INTO user_notification_preferences (user_id, email_enabled, reminder_emails_enabled, weekly_summary_enabled, marketing_emails_enabled, updated_at)
       VALUES ($1, FALSE, FALSE, FALSE, FALSE, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         email_enabled = FALSE,
         reminder_emails_enabled = FALSE,
         weekly_summary_enabled = FALSE,
         marketing_emails_enabled = FALSE,
         updated_at = NOW()`,
      [payload.userId]
    )

    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.send(`<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;padding:40px;color:#0f172a;"><h1>Unsubscribed</h1><p>${payload.email} will no longer receive LangQuiz emails.</p></body></html>`)
  } catch {
    res.status(400).send('<h1>Invalid or expired unsubscribe link</h1>')
  }
})

retentionRouter.post('/run', async (req, res) => {
  const secret = (req.header('x-cron-secret') ?? '').trim()
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    res.status(403).json({ error: 'Forbidden.' })
    return
  }

  try {
    const counts = await runRetentionAutomation()
    res.json({ ok: true, counts })
  } catch (error) {
    console.error('Failed to run retention automation:', error)
    res.status(500).json({ error: 'Failed to run retention automation.' })
  }
})

retentionRouter.use(requireAuth)

retentionRouter.get('/preferences', async (req, res) => {
  try {
    await db.query(
      `INSERT INTO user_notification_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [req.userId]
    )
    const result = await db.query(
      `SELECT email_enabled, reminder_emails_enabled, weekly_summary_enabled, marketing_emails_enabled
       FROM user_notification_preferences
       WHERE user_id = $1`,
      [req.userId]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Failed to load retention preferences:', error)
    res.status(500).json({ error: 'Failed to load retention preferences.' })
  }
})

retentionRouter.put('/preferences', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const emailEnabled = body.email_enabled
  const reminderEnabled = body.reminder_emails_enabled
  const weeklyEnabled = body.weekly_summary_enabled
  const marketingEnabled = body.marketing_emails_enabled

  if (
    typeof emailEnabled !== 'boolean' ||
    typeof reminderEnabled !== 'boolean' ||
    typeof weeklyEnabled !== 'boolean' ||
    typeof marketingEnabled !== 'boolean'
  ) {
    res.status(400).json({ error: 'All notification preference flags must be booleans.' })
    return
  }

  try {
    await db.query(
      `INSERT INTO user_notification_preferences (
         user_id,
         email_enabled,
         reminder_emails_enabled,
         weekly_summary_enabled,
         marketing_emails_enabled,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         email_enabled = EXCLUDED.email_enabled,
         reminder_emails_enabled = EXCLUDED.reminder_emails_enabled,
         weekly_summary_enabled = EXCLUDED.weekly_summary_enabled,
         marketing_emails_enabled = EXCLUDED.marketing_emails_enabled,
         updated_at = NOW()`,
      [req.userId, emailEnabled, reminderEnabled, weeklyEnabled, marketingEnabled]
    )
    res.json({
      email_enabled: emailEnabled,
      reminder_emails_enabled: reminderEnabled,
      weekly_summary_enabled: weeklyEnabled,
      marketing_emails_enabled: marketingEnabled,
    })
  } catch (error) {
    console.error('Failed to save retention preferences:', error)
    res.status(500).json({ error: 'Failed to save retention preferences.' })
  }
})
