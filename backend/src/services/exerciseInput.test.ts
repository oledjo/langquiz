import { describe, expect, test } from 'vitest'
import { normalizeExerciseInput, slugifyDeckTitle } from './exerciseInput'

const defaults = { topic: 'Biology', language: 'en' }
const ok = (raw: unknown) => {
  const result = normalizeExerciseInput(raw, defaults)
  if ('error' in result) throw new Error(result.error)
  return result.exercise
}
const err = (raw: unknown) => {
  const result = normalizeExerciseInput(raw, defaults)
  return 'error' in result ? result.error : null
}

describe('normalizeExerciseInput', () => {
  test('selection: trims text, fills defaults, keeps the answer index', () => {
    expect(ok({ type: 'selection', prompt: '  Powerhouse of the cell? ', options: [' Mitochondria', 'Ribosome'], answer: 0 })).toEqual({
      type: 'selection', topic: 'Biology', subtopic: '', language: 'en', difficulty: 2,
      prompt: 'Powerhouse of the cell?', options: ['Mitochondria', 'Ribosome'], answer: 0,
    })
  })

  test('multiselect: dedupes and sorts correct indices', () => {
    expect(ok({ type: 'multiselect', prompt: 'Primes?', options: ['2', '3', '4'], answers: [1, 0, 1] })).toMatchObject({ answers: [0, 1] })
  })

  test('free-type: any subject text is allowed (not the German-only rule)', () => {
    expect(ok({ type: 'free-type', prompt: 'Capital of France?', answers: ['Paris', ' '], caseSensitive: true })).toMatchObject({
      answers: ['Paris'], caseSensitive: true,
    })
  })

  test('keeps optional explanation/hint/context only when present', () => {
    const exercise = ok({ type: 'free-type', prompt: 'x', answers: ['y'], explanation: 'because', hint: '' })
    expect(exercise).toMatchObject({ explanation: 'because' })
    expect(exercise).not.toHaveProperty('hint')
  })

  test.each([
    [{ type: 'essay', prompt: 'x' }, /type must be/],
    [{ type: 'selection', prompt: ' ', options: ['a', 'b'], answer: 0 }, /question text is required/],
    [{ type: 'selection', prompt: 'x', options: ['a'], answer: 0 }, /2–8 options/],
    [{ type: 'selection', prompt: 'x', options: ['a', 'A'], answer: 0 }, /different/],
    [{ type: 'selection', prompt: 'x', options: ['a', 'b'], answer: 2 }, /exactly one correct/],
    [{ type: 'multiselect', prompt: 'x', options: ['a', 'b'], answers: [] }, /at least one correct/],
    [{ type: 'free-type', prompt: 'x', answers: [] }, /accepted answer/],
    [{ type: 'free-type', prompt: 'x'.repeat(1001), answers: ['y'] }, /at most 1000/],
    [null, /must be an object/],
  ])('rejects invalid input %#', (raw, message) => {
    expect(err(raw)).toMatch(message)
  })

  test('out-of-range difficulty falls back to 2', () => {
    expect(ok({ type: 'free-type', prompt: 'x', answers: ['y'], difficulty: 9 }).difficulty).toBe(2)
  })
})

test('slugifyDeckTitle handles latin, cyrillic, accents and empty input', () => {
  expect(slugifyDeckTitle('Cell Biology 101!')).toBe('cell-biology-101')
  expect(slugifyDeckTitle('Английские глаголы')).toBe('английские-глаголы')
  expect(slugifyDeckTitle('Café Crème')).toBe('cafe-creme')
  expect(slugifyDeckTitle('!!!')).toBe('deck')
})
