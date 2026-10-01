import { describe, expect, test } from 'vitest'
import { capToDailyLimit } from './dueReviews'
import { selectNewExercises } from './newExercises'
import type { Deck } from '../types/deck'
import type { Exercise } from '../types/exercise'
import type { ExerciseStats } from '../api/progressApi'

const deck: Deck = {
  id: '1',
  slug: 'd',
  title: 'D',
  description: '',
  origin: 'community',
  studyModes: ['practice'],
  facetDefinitions: [],
  locales: ['de'],
}

function question(id: string, topic: string): Exercise {
  return { id, type: 'selection', topic, subtopic: 's', language: 'de', difficulty: 1, prompt: id, options: ['a', 'b'], answer: 0 }
}

const stats = (ids: string[]) =>
  new Map<string, ExerciseStats>(ids.map((id) => [id, { exercise_id: id, total_attempts: 1, correct_attempts: 1, last_answered: null }]))

describe('capToDailyLimit', () => {
  test('caps to what is left today, never below zero', () => {
    expect(capToDailyLimit([1, 2, 3], 2)).toEqual([1, 2])
    expect(capToDailyLimit([1, 2, 3], 0)).toEqual([])
    expect(capToDailyLimit([1, 2, 3], -4)).toEqual([])
  })

  test('an unknown limit does not hide anything', () => {
    expect(capToDailyLimit([1, 2, 3], null)).toEqual([1, 2, 3])
    expect(capToDailyLimit([1, 2, 3], undefined)).toEqual([1, 2, 3])
  })
})

describe('selectNewExercises', () => {
  const exercises = [question('a', 'verbs'), question('b', 'nouns'), question('c', 'verbs'), question('d', 'verbs')]

  test('takes never-answered questions in deck order up to the limit', () => {
    expect(selectNewExercises(deck, exercises, stats(['a']), 2).map((e) => e.id)).toEqual(['b', 'c'])
  })

  test('skips paused topics and returns nothing for a paused deck', () => {
    expect(selectNewExercises({ ...deck, pausedTopics: ['verbs'] }, exercises, stats([]), 10).map((e) => e.id)).toEqual(['b'])
    expect(selectNewExercises({ ...deck, learningPaused: true }, exercises, stats([]), 10)).toEqual([])
  })
})
