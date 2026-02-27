import type { AnalyticsEvent, AnalyticsEventName } from './types'
import { captureFirstTouchAttribution, getFirstTouchAttribution } from './utm'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const APP_BASE_URL = import.meta.env.VITE_APP_BASE_URL ?? window.location.origin
const LAST_DAY7_KEY = 'langquiz.analytics.day7.last-fired'

captureFirstTouchAttribution()

function nowIso(): string {
  return new Date().toISOString()
}

function buildEvent(name: AnalyticsEventName, data?: Partial<AnalyticsEvent>): AnalyticsEvent {
  const attribution = getFirstTouchAttribution() ?? undefined
  return {
    event_name: name,
    timestamp: nowIso(),
    ...attribution,
    ...data,
  }
}

export async function trackEvent(name: AnalyticsEventName, data?: Partial<AnalyticsEvent>): Promise<void> {
  const payload = buildEvent(name, data)
  try {
    await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // non-blocking telemetry path
  }
}

export function maybeTrackDay7Retained(opts: { userId: number; createdAt?: string | null }): void {
  const { userId, createdAt } = opts
  if (!createdAt) return

  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return

  const ageMs = Date.now() - created
  if (ageMs < 7 * 24 * 60 * 60 * 1000) return

  const today = new Date().toISOString().slice(0, 10)
  const dedupeKey = `${LAST_DAY7_KEY}:${userId}:${today}`
  if (localStorage.getItem(dedupeKey)) return

  localStorage.setItem(dedupeKey, '1')
  void trackEvent('day7_retained', {
    user_id: userId,
    properties: {
      app_base_url: APP_BASE_URL,
      account_age_days: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
    },
  })
}
