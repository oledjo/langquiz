/**
 * Storage keys moved from the `langquiz.` prefix to `reps.` as part of the
 * rebrand. `readWithLegacyFallback` lets existing sessions keep working
 * until they naturally re-write the value under the new key.
 */

export const AUTH_TOKEN_KEY = 'reps.auth-token'
export const LEGACY_AUTH_TOKEN_KEY = 'langquiz.auth-token'

export const CUSTOM_EXERCISES_KEY = 'reps.custom-exercises.v1'
export const LEGACY_CUSTOM_EXERCISES_KEY = 'langquiz.custom-exercises.v1'

export const ANALYTICS_DAY7_KEY = 'reps.analytics.day7.last-fired'
export const LEGACY_ANALYTICS_DAY7_KEY = 'langquiz.analytics.day7.last-fired'

export const UTM_FIRST_TOUCH_KEY = 'reps.utm.first-touch.v1'
export const LEGACY_UTM_FIRST_TOUCH_KEY = 'langquiz.utm.first-touch.v1'

export const PROGRESS_UPDATED_EVENT = 'reps:progress-updated'

export function readWithLegacyFallback(key: string, legacyKey: string): string | null {
  const current = localStorage.getItem(key)
  if (current !== null) return current
  return localStorage.getItem(legacyKey)
}
