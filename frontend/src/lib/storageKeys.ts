/**
 * Storage keys have moved prefix twice: `langquiz.` -> `reps.` -> `repzy.`.
 * `readWithLegacyFallback` reads keys in priority order so existing sessions
 * from either earlier prefix keep working until they naturally re-write the
 * value under the current key.
 */

export const AUTH_TOKEN_KEY = 'repzy.auth-token'
export const REPS_AUTH_TOKEN_KEY = 'reps.auth-token'
export const LEGACY_AUTH_TOKEN_KEY = 'langquiz.auth-token'

export const CUSTOM_EXERCISES_KEY = 'repzy.custom-exercises.v1'
export const REPS_CUSTOM_EXERCISES_KEY = 'reps.custom-exercises.v1'
export const LEGACY_CUSTOM_EXERCISES_KEY = 'langquiz.custom-exercises.v1'

export const ANALYTICS_DAY7_KEY = 'repzy.analytics.day7.last-fired'
export const REPS_ANALYTICS_DAY7_KEY = 'reps.analytics.day7.last-fired'
export const LEGACY_ANALYTICS_DAY7_KEY = 'langquiz.analytics.day7.last-fired'

export const UTM_FIRST_TOUCH_KEY = 'repzy.utm.first-touch.v1'
export const REPS_UTM_FIRST_TOUCH_KEY = 'reps.utm.first-touch.v1'
export const LEGACY_UTM_FIRST_TOUCH_KEY = 'langquiz.utm.first-touch.v1'

export const PROGRESS_UPDATED_EVENT = 'repzy:progress-updated'

export function readWithLegacyFallback(...keysInPriorityOrder: string[]): string | null {
  for (const key of keysInPriorityOrder) {
    const value = localStorage.getItem(key)
    if (value !== null) return value
  }
  return null
}
