import { describe, expect, test } from 'vitest'
import { selectFailedExercises } from './failedExercises'
import type { ExerciseStats } from '../api/progressApi'
import type { Exercise } from '../types/exercise'

function exercise(id: string): Exercise {
  return {
    id,
    type: 'selection',
    topic: 'articles',
    subtopic: 'der',
    language: 'de',
    difficulty: 1,
    prompt: `Prompt ${id}`,
    options: ['a', 'b'],
    answer: 0,
  }
}

function stats(exerciseId: string, overrides: Partial<ExerciseStats> = {}): ExerciseStats {
  return { exercise_id: exerciseId, total_attempts: 1, correct_attempts: 0, last_answered: null, ...overrides }
}

describe('selectFailedExercises', () => {
  test('keeps only exercises whose most recent answer was "again"', () => {
    const exercises = [exercise('a'), exercise('b'), exercise('c')]
    const statsByExerciseId = new Map([
      ['a', stats('a', { last_answer_grade: 'again' })],
      ['b', stats('b', { last_answer_grade: 'good' })],
    ])

    expect(selectFailedExercises(exercises, statsByExerciseId).map((e) => e.id)).toEqual(['a'])
  })

  test('excludes an exercise with no stats row at all (untried, not failed)', () => {
    const exercises = [exercise('a')]

    expect(selectFailedExercises(exercises, new Map())).toEqual([])
  })

  test('excludes an exercise that was failed before but is now getting answered correctly', () => {
    const exercises = [exercise('a')]
    const statsByExerciseId = new Map([['a', stats('a', { last_answer_grade: 'good' })]])

    expect(selectFailedExercises(exercises, statsByExerciseId)).toEqual([])
  })
})
