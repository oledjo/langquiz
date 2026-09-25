import { describe, expect, test } from 'vitest'
import { attachRecentResults, RECENT_RESULTS_LIMIT } from './stats'

describe('attachRecentResults', () => {
  test('attaches each exercise its own recent results, preserving row order and fields', () => {
    const rows = [
      { exercise_id: 'b', total_attempts: 3 },
      { exercise_id: 'a', total_attempts: 2 },
    ]
    const result = attachRecentResults(rows, [
      { exercise_id: 'a', recent: [false, true] },
      { exercise_id: 'b', recent: [true, false, false] },
    ])
    expect(result).toEqual([
      { exercise_id: 'b', total_attempts: 3, recent: [true, false, false] },
      { exercise_id: 'a', total_attempts: 2, recent: [false, true] },
    ])
  })

  test('gives an empty array to exercises without history or with a null aggregate', () => {
    const result = attachRecentResults(
      [{ exercise_id: 'x' }, { exercise_id: 'y' }],
      [{ exercise_id: 'y', recent: null }]
    )
    expect(result.map((row) => row.recent)).toEqual([[], []])
  })

  test('ignores history rows for exercises outside the requested stats (e.g. other decks)', () => {
    const result = attachRecentResults([{ exercise_id: 'a' }], [
      { exercise_id: 'a', recent: [true] },
      { exercise_id: 'other-deck', recent: [false] },
    ])
    expect(result).toEqual([{ exercise_id: 'a', recent: [true] }])
  })

  test('caps history at 10 answers', () => {
    expect(RECENT_RESULTS_LIMIT).toBe(10)
  })
})
