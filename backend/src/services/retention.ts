import { db } from '../db/database'
import { buildUnsubscribeUrl, sendEmail } from './email'

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://langquiz.onrender.com'

interface NotificationPreferencesRow {
  email_enabled: boolean
  reminder_emails_enabled: boolean
  weekly_summary_enabled: boolean
  marketing_emails_enabled: boolean
}

interface UserCandidate {
  id: number
  email: string
  created_at: string
}

interface WeakTopic {
  topic: string
  attempts: number
  correct: number
  accuracy_pct: number
}

function emailLayout(args: { title: string; intro: string; ctaLabel: string; ctaUrl: string; body: string; unsubscribeUrl: string }): { html: string; text: string } {
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6;">
      <h1 style="font-size:24px;margin-bottom:12px;">${args.title}</h1>
      <p>${args.intro}</p>
      <p>${args.body}</p>
      <p style="margin:24px 0;">
        <a href="${args.ctaUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;display:inline-block;">${args.ctaLabel}</a>
      </p>
      <p style="font-size:12px;color:#64748b;">You can unsubscribe from retention emails anytime: <a href="${args.unsubscribeUrl}">${args.unsubscribeUrl}</a></p>
    </div>
  `.trim()
  const text = `${args.title}\n\n${args.intro}\n\n${args.body}\n\n${args.ctaLabel}: ${args.ctaUrl}\n\nUnsubscribe: ${args.unsubscribeUrl}`
  return { html, text }
}

async function ensurePreferences(userId: number): Promise<NotificationPreferencesRow> {
  await db.query(
    `INSERT INTO user_notification_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  )
  const result = await db.query(
    `SELECT email_enabled, reminder_emails_enabled, weekly_summary_enabled, marketing_emails_enabled
     FROM user_notification_preferences
     WHERE user_id = $1`,
    [userId]
  )
  return result.rows[0] as NotificationPreferencesRow
}

async function recordDelivery(userId: number, notificationKey: string, metadata: Record<string, unknown>): Promise<void> {
  await db.query(
    `INSERT INTO notification_deliveries (user_id, notification_key, metadata)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, notification_key, channel) DO NOTHING`,
    [userId, notificationKey, JSON.stringify(metadata)]
  )
}

async function hasDelivery(userId: number, notificationKey: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM notification_deliveries WHERE user_id = $1 AND notification_key = $2 LIMIT 1`,
    [userId, notificationKey]
  )
  return Boolean(result.rowCount)
}

async function getAttemptsCount(userId: number): Promise<number> {
  const result = await db.query(`SELECT COUNT(*)::INT AS total FROM progress WHERE user_id = $1`, [userId])
  return (result.rows[0] as { total: number }).total ?? 0
}

async function getSessionCompletionStats(userId: number): Promise<{ total: number; lastCompletedAt: string | null }> {
  const result = await db.query(
    `SELECT COUNT(*)::INT AS total, MAX(created_at) AS last_completed_at
     FROM analytics_events
     WHERE user_id = $1 AND event_name = 'session_completed'`,
    [userId]
  )
  const row = result.rows[0] as { total: number; last_completed_at: string | null }
  return {
    total: row?.total ?? 0,
    lastCompletedAt: row?.last_completed_at ?? null,
  }
}

async function getWeakTopics(userId: number): Promise<WeakTopic[]> {
  const result = await db.query(
    `WITH exercise_topics AS (
       SELECT e.exercise_id, e.data->>'topic' AS topic, NULL::BIGINT AS owner_user_id
       FROM exercises e
       UNION ALL
       SELECT ue.exercise_id, ue.data->>'topic' AS topic, ue.user_id AS owner_user_id
       FROM user_exercises ue
     )
     SELECT
       et.topic,
       COUNT(*)::INT AS attempts,
       SUM(CASE WHEN p.correct THEN 1 ELSE 0 END)::INT AS correct,
       ROUND((SUM(CASE WHEN p.correct THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100)::INT AS accuracy_pct
     FROM progress p
     JOIN exercise_topics et
       ON et.exercise_id = p.exercise_id
      AND (et.owner_user_id IS NULL OR et.owner_user_id = p.user_id)
     WHERE p.user_id = $1
       AND p.answered_at >= NOW() - INTERVAL '14 days'
       AND et.topic IS NOT NULL
       AND et.topic <> ''
     GROUP BY et.topic
     HAVING COUNT(*) >= 2
     ORDER BY accuracy_pct ASC, attempts DESC, et.topic ASC
     LIMIT 3`,
    [userId]
  )

  return result.rows as WeakTopic[]
}

async function sendNotification(user: UserCandidate, notificationKey: string, subject: string, intro: string, body: string, ctaUrl: string, ctaLabel: string): Promise<boolean> {
  const unsubscribeUrl = buildUnsubscribeUrl(user.id, user.email)
  const email = emailLayout({
    title: subject,
    intro,
    body,
    ctaLabel,
    ctaUrl,
    unsubscribeUrl,
  })
  await sendEmail({ to: user.email, subject, html: email.html, text: email.text })
  await recordDelivery(user.id, notificationKey, { subject, ctaUrl })
  return true
}

async function allUsers(): Promise<UserCandidate[]> {
  const result = await db.query(`SELECT id, email, created_at FROM users ORDER BY id ASC`)
  return result.rows as UserCandidate[]
}

function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export async function runRetentionAutomation(): Promise<Record<string, number>> {
  const users = await allUsers()
  const counts = {
    d1IncompleteOnboarding: 0,
    d3NoSessionCompletion: 0,
    d7Comeback: 0,
    weeklyWeakTopics: 0,
  }

  for (const user of users) {
    const prefs = await ensurePreferences(user.id)
    if (!prefs.email_enabled) continue

    const createdAt = Date.parse(user.created_at)
    const accountAgeMs = Date.now() - createdAt
    const attempts = await getAttemptsCount(user.id)
    const sessionStats = await getSessionCompletionStats(user.id)

    if (prefs.reminder_emails_enabled && accountAgeMs >= 24 * 60 * 60 * 1000) {
      const key = 'd1_incomplete_onboarding_v1'
      if (attempts < 10 && !(await hasDelivery(user.id, key))) {
        await sendNotification(
          user,
          key,
          'Finish your first 10 LangQuiz questions',
          'You are one short session away from establishing a strong practice baseline.',
          'Choose a topic, set your level, and complete a focused 10-question session. This gives LangQuiz enough signal to personalize what you should review next.',
          `${APP_BASE_URL}/?utm_source=retention&utm_medium=email&utm_campaign=d1_incomplete_onboarding`,
          'Complete your first session'
        )
        counts.d1IncompleteOnboarding += 1
      }
    }

    if (prefs.reminder_emails_enabled && accountAgeMs >= 3 * 24 * 60 * 60 * 1000) {
      const key = 'd3_no_session_completion_v1'
      if (sessionStats.total === 0 && !(await hasDelivery(user.id, key))) {
        await sendNotification(
          user,
          key,
          'Your German practice setup is waiting',
          'You signed up, but you have not completed a session yet.',
          'Start with a short focused run. The fastest way to get value is one 10-question session on a single weak topic.',
          `${APP_BASE_URL}/?utm_source=retention&utm_medium=email&utm_campaign=d3_no_session_completion`,
          'Start a focused session'
        )
        counts.d3NoSessionCompletion += 1
      }
    }

    if (prefs.reminder_emails_enabled && sessionStats.total > 0 && sessionStats.lastCompletedAt) {
      const lastCompletedMs = Date.parse(sessionStats.lastCompletedAt)
      const inactiveForMs = Date.now() - lastCompletedMs
      const key = 'd7_comeback_v1'
      if (inactiveForMs >= 7 * 24 * 60 * 60 * 1000 && !(await hasDelivery(user.id, key))) {
        await sendNotification(
          user,
          key,
          'Time for a quick comeback drill',
          'A short return session is the fastest way to regain momentum.',
          'Come back for a 12-minute run. Your earlier mistakes are still the best place to restart because they produce the biggest retention gain.',
          `${APP_BASE_URL}/?utm_source=retention&utm_medium=email&utm_campaign=d7_comeback`,
          'Resume practice'
        )
        counts.d7Comeback += 1
      }
    }

    if (prefs.weekly_summary_enabled) {
      const weekKey = `weekly_weak_topics_${isoWeekKey()}`
      if (await hasDelivery(user.id, weekKey)) continue
      const weakTopics = await getWeakTopics(user.id)
      if (weakTopics.length === 0) continue

      const topicSummary = weakTopics
        .map((topic) => `${topic.topic}: ${topic.correct}/${topic.attempts} correct (${topic.accuracy_pct}%)`)
        .join('; ')

      await sendNotification(
        user,
        weekKey,
        'Your weak topics this week',
        'Here is where the next small practice block will have the highest payoff.',
        `Focus on these topics first: ${topicSummary}. Run one focused session and let mistake-weighted review guide what comes next.`,
        `${APP_BASE_URL}/?utm_source=retention&utm_medium=email&utm_campaign=weekly_weak_topics`,
        'Review weak topics'
      )
      counts.weeklyWeakTopics += 1
    }
  }

  return counts
}
