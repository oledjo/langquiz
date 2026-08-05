import { describe, expect, test } from 'vitest'
import { filterExercisesByDeck } from './filterExercisesByDeck'
import type { SelectionExercise } from '../types/exercise'

function makeExercise(overrides: Partial<SelectionExercise>): SelectionExercise {
  return {
    id: 'ex-1',
    type: 'selection',
    topic: 'articles',
    subtopic: 'der',
    language: 'de',
    difficulty: 1,
    prompt: 'p',
    options: ['a', 'b'],
    answer: 0,
    ...overrides,
  }
}

describe('filterExercisesByDeck', () => {
  test('keeps exercises whose deckId matches the allowed deck', () => {
    const exercises = [makeExercise({ id: 'a', deckId: '1' })]

    expect(filterExercisesByDeck(exercises, '1')).toEqual(exercises)
  })

  test('drops exercises whose deckId does not match the allowed deck', () => {
    const exercises = [makeExercise({ id: 'a', deckId: '2' })]

    expect(filterExercisesByDeck(exercises, '1')).toEqual([])
  })

  test('keeps exercises with no deckId at all', () => {
    const exercises = [makeExercise({ id: 'a', deckId: undefined })]

    expect(filterExercisesByDeck(exercises, '1')).toEqual(exercises)
  })

  test('keeps everything when allowedDeckId is undefined', () => {
    const exercises = [makeExercise({ id: 'a', deckId: '2' }), makeExercise({ id: 'b', deckId: undefined })]

    expect(filterExercisesByDeck(exercises, undefined)).toEqual(exercises)
  })
})
