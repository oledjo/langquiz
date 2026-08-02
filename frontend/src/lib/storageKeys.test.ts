import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { AUTH_TOKEN_KEY, PROGRESS_UPDATED_EVENT, readWithLegacyFallback } from './storageKeys'

describe('storage key constants', () => {
  test('AUTH_TOKEN_KEY uses the reps prefix', () => {
    expect(AUTH_TOKEN_KEY).toBe('reps.auth-token')
  })

  test('PROGRESS_UPDATED_EVENT uses the reps prefix', () => {
    expect(PROGRESS_UPDATED_EVENT).toBe('reps:progress-updated')
  })
})

describe('readWithLegacyFallback', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  test('reads the new key when present', () => {
    localStorage.setItem('reps.auth-token', 'new-value')
    localStorage.setItem('langquiz.auth-token', 'old-value')

    expect(readWithLegacyFallback('reps.auth-token', 'langquiz.auth-token')).toBe('new-value')
  })

  test('falls back to the legacy key when the new key is absent', () => {
    localStorage.setItem('langquiz.auth-token', 'old-value')

    expect(readWithLegacyFallback('reps.auth-token', 'langquiz.auth-token')).toBe('old-value')
  })

  test('returns null when neither key is present', () => {
    expect(readWithLegacyFallback('reps.auth-token', 'langquiz.auth-token')).toBeNull()
  })
})
