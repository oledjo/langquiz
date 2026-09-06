import { describe, expect, test } from 'vitest'
import { parseBatchItems, parseSince } from './progress'

describe('parseBatchItems', () => {
  const ok = { clientId: 'c1', exercise_id: 'ex-1', correct: true, answer_grade: 'good', mode: 'practice' }

  test('accepts a well-formed items array', () => {
    const result = parseBatchItems({ items: [ok] })
    expect('items' in result && result.items).toEqual([ok])
  })

  test('rejects a non-object / missing items', () => {
    expect('error' in parseBatchItems(null)).toBe(true)
    expect('error' in parseBatchItems({})).toBe(true)
    expect('error' in parseBatchItems({ items: 'nope' })).toBe(true)
  })

  test('rejects an empty batch and a batch over 200', () => {
    expect('error' in parseBatchItems({ items: [] })).toBe(true)
    expect('error' in parseBatchItems({ items: Array(201).fill(ok) })).toBe(true)
  })

  test('rejects an item with a bad grade, missing clientId, or non-boolean correct', () => {
    expect('error' in parseBatchItems({ items: [{ ...ok, answer_grade: 'meh' }] })).toBe(true)
    expect('error' in parseBatchItems({ items: [{ ...ok, clientId: '' }] })).toBe(true)
    expect('error' in parseBatchItems({ items: [{ ...ok, correct: 'yes' }] })).toBe(true)
  })

  test('rejects grade/correct mismatch (again+correct, good+incorrect)', () => {
    expect('error' in parseBatchItems({ items: [{ ...ok, answer_grade: 'again' }] })).toBe(true)
    expect('error' in parseBatchItems({ items: [{ ...ok, correct: false }] })).toBe(true)
  })

  test('defaults mode to practice when omitted', () => {
    const { clientId, exercise_id, correct, answer_grade } = ok
    const result = parseBatchItems({ items: [{ clientId, exercise_id, correct, answer_grade }] })
    expect('items' in result && result.items[0].mode).toBe('practice')
  })
})

describe('parseSince', () => {
  test('returns a valid ISO-8601 string unchanged', () => {
    expect(parseSince('2026-09-01T10:00:00.000Z')).toBe('2026-09-01T10:00:00.000Z')
  })
  test('returns null for absent or invalid input', () => {
    expect(parseSince(undefined)).toBeNull()
    expect(parseSince('last tuesday')).toBeNull()
    expect(parseSince(12345)).toBeNull()
  })
})
