import { Router } from 'express'
import { db } from '../db/database'
import { basicBotGuard, rateLimit } from '../middleware/security'

export const eventsRouter = Router()
const eventsLimiter = rateLimit({ keyPrefix: 'events', windowMs: 5 * 60 * 1000, max: 300 })

eventsRouter.use(basicBotGuard, eventsLimiter)

interface EventPayload {
  event_name: string
  session_id?: string
  timestamp?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  properties?: Record<string, unknown>
  user_id?: number
}

function normalizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

eventsRouter.post('/', async (req, res) => {
  const body = req.body as EventPayload | null
  const eventName = normalizeString(body?.event_name, 64)

  if (!eventName) {
    res.status(400).json({ error: 'event_name is required.' })
    return
  }

  const sessionId = normalizeString(body?.session_id, 128)
  const utmSource = normalizeString(body?.utm_source, 128)
  const utmMedium = normalizeString(body?.utm_medium, 128)
  const utmCampaign = normalizeString(body?.utm_campaign, 128)
  const clientTimestamp = normalizeString(body?.timestamp, 64)
  const properties = body?.properties && typeof body.properties === 'object' ? body.properties : {}
  const userId = typeof body?.user_id === 'number' && Number.isInteger(body.user_id) ? body.user_id : null

  try {
    await db.query(
      `INSERT INTO analytics_events (
         event_name,
         session_id,
         user_id,
         client_timestamp,
         utm_source,
         utm_medium,
         utm_campaign,
         properties
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventName,
        sessionId,
        userId,
        clientTimestamp,
        utmSource,
        utmMedium,
        utmCampaign,
        JSON.stringify(properties),
      ]
    )

    res.status(202).json({ accepted: true })
  } catch (error) {
    console.error('Failed to store analytics event:', error)
    res.status(500).json({ error: 'Failed to store event.' })
  }
})
