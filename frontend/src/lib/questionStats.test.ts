import { describe, expect, test } from 'vitest'
import { accuracyPercent, questionStatsWithAnswer } from './questionStats'
import type { ExerciseStats } from '../api/progressApi'

const stat = (overrides: Partial<ExerciseStats> = {}): ExerciseStats => ({
  exercise_id: 'q', total_attempts: 2, correct_attempts: 1, last_answered: null, recent: [true, false], ...overrides,
})

describe('questionStatsWithAnswer', () => {
  test('adds the answer on screen to saved history, newest last', () => {
    expect(questionStatsWithAnswer(stat(), false)).toEqual({ correct: 1, incorrect: 2, recent: [true, false, false] })
    expect(questionStatsWithAnswer(stat(), true)).toEqual({ correct: 2, incorrect: 1, recent: [true, false, true] })
  })

  test('guests and never-answered questions show only the current answer', () => {
    expect(questionStatsWithAnswer(undefined, true)).toEqual({ correct: 1, incorrect: 0, recent: [true] })
  })

  test('works against a backend that does not send recent yet', () => {
    expect(questionStatsWithAnswer(stat({ recent: undefined }), true).recent).toEqual([true])
  })

  test('keeps only the last 10 answers', () => {
    const recent = questionStatsWithAnswer(stat({ total_attempts: 10, correct_attempts: 0, recent: Array(10).fill(false) }), true).recent
    expect(recent).toHaveLength(10)
    expect(recent.at(-1)).toBe(true)
  })
})

test('accuracyPercent rounds and is null with no answers', () => {
  expect(accuracyPercent({ correct: 2, incorrect: 1, recent: [] })).toBe(67)
  expect(accuracyPercent({ correct: 0, incorrect: 0, recent: [] })).toBeNull()
})
