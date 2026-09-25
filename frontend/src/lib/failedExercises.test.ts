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
    const statsByExerciseId = new Map([['a', stats('a', { correct_attempts: 1, last_answer_grade: 'good' })]])

    expect(selectFailedExercises(exercises, statsByExerciseId)).toEqual([])
  })

  test('matches the iOS problem rule: lapses and low accuracy count, 3 right in a row clears', () => {
    const exercises = ['lastWrong', 'lapses', 'lowAcc', 'mastered', 'fine'].map(exercise)
    const statsByExerciseId = new Map([
      ['lastWrong', stats('lastWrong', { total_attempts: 5, correct_attempts: 4, recent: [true, true, false] })],
      ['lapses', stats('lapses', { total_attempts: 6, correct_attempts: 4, lapse_count: 2, recent: [false, true] })],
      ['lowAcc', stats('lowAcc', { total_attempts: 3, correct_attempts: 1, recent: [false, false, true] })],
      ['mastered', stats('mastered', { total_attempts: 8, correct_attempts: 3, lapse_count: 4, recent: [false, true, true, true] })],
      ['fine', stats('fine', { total_attempts: 1, correct_attempts: 1, recent: [true] })],
    ])

    expect(selectFailedExercises(exercises, statsByExerciseId).map((e) => e.id)).toEqual(['lastWrong', 'lapses', 'lowAcc'])
  })
})
