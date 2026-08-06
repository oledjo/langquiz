import { describe, expect, test, vi } from 'vitest'
import { shuffle } from './shuffle'

describe('shuffle', () => {
  test('returns a new array containing the same items', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)

    expect(result).not.toBe(input)
    expect([...result].sort()).toEqual([...input].sort())
  })

  test('does not mutate the input array', () => {
    const input = [1, 2, 3]
    const original = [...input]
    shuffle(input)

    expect(input).toEqual(original)
  })

  test('actually reorders the items (with Math.random pinned to a non-identity permutation)', () => {
    // Math.random = 0 makes Fisher-Yates always swap the current index with index 0, which is
    // a definite, non-identity permutation for any array of length >= 2 (unlike e.g. 0.999,
    // which rounds down to `i` itself at every step and produces no swaps at all).
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = shuffle([1, 2, 3, 4])
    vi.restoreAllMocks()

    expect(result).toEqual([2, 3, 4, 1])
  })

  test('handles empty and single-item arrays', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle([1])).toEqual([1])
  })
})
