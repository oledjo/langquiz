import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchExercisesForDeck } from './exercisesApi'

const originalFetch = globalThis.fetch

describe('fetchExercisesForDeck', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('calls GET /api/exercises with the deckId query param and returns the parsed array', async () => {
    const mockExercises = [{ id: 'x', type: 'selection', topic: 't', subtopic: 's', language: 'de', difficulty: 1, prompt: 'p', options: ['a'], answer: 0 }]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExercises),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchExercisesForDeck('1')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/exercises\?deckId=1$/),
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toEqual(mockExercises)
  })

  test('throws on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    await expect(fetchExercisesForDeck('1')).rejects.toThrow('GET /api/exercises?deckId=1 failed: 500')
  })

  test('URL-encodes the deckId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchExercisesForDeck('a b/c')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`deckId=${encodeURIComponent('a b/c')}`),
      expect.anything()
    )
  })
})
