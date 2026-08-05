import { describe, expect, test } from 'vitest'
import { isValidProgressMode } from './progress'
import { parseDeckIdParam } from './queryParams'

describe('isValidProgressMode', () => {
  test('accepts practice and exam', () => {
    expect(isValidProgressMode('practice')).toBe(true)
    expect(isValidProgressMode('exam')).toBe(true)
  })

  test('accepts undefined (defaults to practice at the call site)', () => {
    expect(isValidProgressMode(undefined)).toBe(true)
  })

  test('rejects anything else', () => {
    expect(isValidProgressMode('due-review')).toBe(false)
    expect(isValidProgressMode('')).toBe(false)
    expect(isValidProgressMode(123)).toBe(false)
    expect(isValidProgressMode(null)).toBe(false)
  })
})

describe('parseDeckIdParam (used by review-metrics deckId scoping)', () => {
  test('parses a numeric string into a number', () => {
    expect(parseDeckIdParam('7')).toBe(7)
  })

  test('returns null when absent', () => {
    expect(parseDeckIdParam(undefined)).toBeNull()
  })
})
