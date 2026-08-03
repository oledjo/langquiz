import { renderHook, waitFor } from '@testing-library/react'
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
})
