import { describe, expect, test } from 'vitest'
import { buildTrainingItems, countLongTermReviews } from './fsrsOptimizer'
import { computeNextReview, isValidFsrsParameters } from './reviewScheduler'

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 12))

describe('buildTrainingItems', () => {
  test('one item per answer after the first, with whole-day gaps and ratings', () => {
    const items = buildTrainingItems([
      { exercise_id: 'q', answer_grade: 'good', correct: true, answered_at: day(0) },
      { exercise_id: 'q', answer_grade: 'again', correct: false, answered_at: day(3) },
      { exercise_id: 'q', answer_grade: null, correct: true, answered_at: day(3) },
      { exercise_id: 'solo', answer_grade: 'easy', correct: true, answered_at: day(1) },
    ])
    expect(items).toEqual([
      [{ rating: 3, deltaT: 0 }, { rating: 1, deltaT: 3 }],
      [{ rating: 3, deltaT: 0 }, { rating: 1, deltaT: 3 }, { rating: 3, deltaT: 0 }],
    ])
    expect(countLongTermReviews(items)).toBe(1)
  })

  test('sorts each question by time regardless of input order', () => {
    const items = buildTrainingItems([
      { exercise_id: 'q', answer_grade: 'hard', correct: true, answered_at: day(5) },
      { exercise_id: 'q', answer_grade: 'good', correct: true, answered_at: day(1) },
    ])
    expect(items).toEqual([[{ rating: 3, deltaT: 0 }, { rating: 2, deltaT: 4 }]])
  })
})

describe('personal FSRS parameters', () => {
  const defaults = [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483,
    0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
  ]

  test('only full FSRS-6 weight sets are accepted', () => {
    expect(isValidFsrsParameters(defaults)).toBe(true)
    expect(isValidFsrsParameters(defaults.slice(0, 19))).toBe(false)
    expect(isValidFsrsParameters([...defaults.slice(0, 20), Number.NaN])).toBe(false)
  })

  test('different weights give different intervals; invalid weights fall back to the defaults', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const slowForgetter = [...defaults]
    slowForgetter[3] = 40 // initial stability after "easy"
    const standard = computeNextReview(null, 'easy', now)
    expect(computeNextReview(null, 'easy', now, slowForgetter).intervalDays).toBeGreaterThan(standard.intervalDays)
    expect(computeNextReview(null, 'easy', now, [1, 2, 3]).intervalDays).toBe(standard.intervalDays)
  })
})
