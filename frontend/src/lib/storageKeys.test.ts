import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { AUTH_TOKEN_KEY, PROGRESS_UPDATED_EVENT, readWithLegacyFallback } from './storageKeys'

describe('storage key constants', () => {
  test('AUTH_TOKEN_KEY uses the repzy prefix', () => {
    expect(AUTH_TOKEN_KEY).toBe('repzy.auth-token')
  })

  test('PROGRESS_UPDATED_EVENT uses the repzy prefix', () => {
    expect(PROGRESS_UPDATED_EVENT).toBe('repzy:progress-updated')
  })
})

describe('readWithLegacyFallback', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  test('reads the newest key when present', () => {
    localStorage.setItem('repzy.auth-token', 'newest-value')
    localStorage.setItem('reps.auth-token', 'middle-value')
    localStorage.setItem('langquiz.auth-token', 'oldest-value')

    expect(readWithLegacyFallback('repzy.auth-token', 'reps.auth-token', 'langquiz.auth-token')).toBe(
      'newest-value'
    )
  })

  test('falls back one hop to the reps-era key when the newest key is absent', () => {
    localStorage.setItem('reps.auth-token', 'middle-value')
    localStorage.setItem('langquiz.auth-token', 'oldest-value')

    expect(readWithLegacyFallback('repzy.auth-token', 'reps.auth-token', 'langquiz.auth-token')).toBe(
      'middle-value'
    )
  })

  test('falls back two hops to the langquiz-era key when neither newer key is present', () => {
    localStorage.setItem('langquiz.auth-token', 'oldest-value')

    expect(readWithLegacyFallback('repzy.auth-token', 'reps.auth-token', 'langquiz.auth-token')).toBe(
      'oldest-value'
    )
  })

  test('returns null when no key is present', () => {
    expect(readWithLegacyFallback('repzy.auth-token', 'reps.auth-token', 'langquiz.auth-token')).toBeNull()
  })
})
