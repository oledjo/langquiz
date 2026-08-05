import { describe, expect, test } from 'vitest'
import { parseDeckIdParam } from './queryParams'

describe('parseDeckIdParam', () => {
  test('parses a numeric string into a number', () => {
    expect(parseDeckIdParam('42')).toBe(42)
  })

  test('returns null for undefined', () => {
    expect(parseDeckIdParam(undefined)).toBeNull()
  })

  test('returns null for an empty string', () => {
    expect(parseDeckIdParam('')).toBeNull()
  })

  test('returns null for a non-numeric string', () => {
    expect(parseDeckIdParam('not-a-number')).toBeNull()
  })

  test('returns null for a non-string value (e.g. an array from repeated query params)', () => {
    expect(parseDeckIdParam(['1', '2'])).toBeNull()
  })
})
