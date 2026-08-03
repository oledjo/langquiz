import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useDeckExercises } from './useDeckExercises'
import * as exercisesApi from '../api/exercisesApi'

describe('useDeckExercises', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('starts in a loading state and then resolves with the fetched exercises', async () => {
    const mockExercises = [{ id: 'x', type: 'selection' as const, topic: 't', subtopic: 's', language: 'de', difficulty: 1 as const, prompt: 'p', options: ['a'], answer: 0 }]
    const spy = vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(mockExercises)

    const { result } = renderHook(() => useDeckExercises('1'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(spy).toHaveBeenCalledWith('1')
    expect(result.current.exercises).toEqual(mockExercises)
    expect(result.current.error).toBeNull()
  })

  test('captures an error message when the fetch rejects', async () => {
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockRejectedValue(new Error('GET /api/exercises?deckId=1 failed: 500'))

    const { result } = renderHook(() => useDeckExercises('1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.exercises).toEqual([])
    expect(result.current.error).toBe('GET /api/exercises?deckId=1 failed: 500')
  })

  test('does not fetch and stays loading while deckId is empty, then fetches once a real id arrives', async () => {
    const mockExercises = [{ id: 'x', type: 'selection' as const, topic: 't', subtopic: 's', language: 'de', difficulty: 1 as const, prompt: 'p', options: ['a'], answer: 0 }]
    // A deliberately-not-yet-resolved promise, so the assertion right after rerender observes
    // the real in-flight window rather than a fetch that already settled during the rerender's
    // microtask flush (which is what happens with mockResolvedValue here, since act(async...)
    // drains pending microtasks before returning).
    let resolveFetch: (value: typeof mockExercises) => void = () => {}
    const pendingFetch = new Promise<typeof mockExercises>((resolve) => {
      resolveFetch = resolve
    })
    const spy = vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockReturnValue(pendingFetch)

    const { result, rerender } = renderHook(({ deckId }) => useDeckExercises(deckId), {
      initialProps: { deckId: '' },
    })

    expect(result.current.loading).toBe(true)
    expect(spy).not.toHaveBeenCalled()

    await act(async () => {
      rerender({ deckId: '1' })
    })

    // Regression check: the loading flag must not have dropped to false during the empty->real
    // transition (which would let a caller briefly render an empty-exercises "not found" state
    // before the real fetch resolves) - it should stay true straight through the fetch's
    // in-flight window, not just at the two endpoints.
    expect(result.current.loading).toBe(true)
    expect(spy).toHaveBeenCalledWith('1')
    expect(spy).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch(mockExercises)
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.exercises).toEqual(mockExercises)
  })
})
