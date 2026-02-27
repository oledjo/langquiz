import type { Attribution } from './types'

const FIRST_TOUCH_KEY = 'langquiz.utm.first-touch.v1'

function readQueryAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search)
  const source = params.get('utm_source')?.trim() || undefined
  const medium = params.get('utm_medium')?.trim() || undefined
  const campaign = params.get('utm_campaign')?.trim() || undefined
  return {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
  }
}

function hasAttribution(attribution: Attribution): boolean {
  return Boolean(attribution.utm_source || attribution.utm_medium || attribution.utm_campaign)
}

export function captureFirstTouchAttribution(): Attribution | null {
  try {
    const existing = localStorage.getItem(FIRST_TOUCH_KEY)
    if (existing) return JSON.parse(existing) as Attribution

    const fromQuery = readQueryAttribution()
    if (!hasAttribution(fromQuery)) return null

    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(fromQuery))
    return fromQuery
  } catch {
    return null
  }
}

export function getFirstTouchAttribution(): Attribution | null {
  try {
    const stored = localStorage.getItem(FIRST_TOUCH_KEY)
    if (!stored) return null
    return JSON.parse(stored) as Attribution
  } catch {
    return null
  }
}
