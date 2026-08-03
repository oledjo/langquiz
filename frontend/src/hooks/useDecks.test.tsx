import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useDeck, useDecks } from './useDecks'
import * as decksApi from '../api/decksApi'

describe('useDecks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('starts in a loading state and then resolves with the fetched decks', async () => {
    const mockDecks = [
      { id: '1', slug: 'a', title: 'A', description: '', origin: 'official' as const, studyModes: ['practice' as const], facetDefinitions: [], locales: ['en'] },
    ]
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)

    const { result } = renderHook(() => useDecks())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.decks).toEqual(mockDecks)
    expect(result.current.error).toBeNull()
  })

  test('captures an error message when the fetch rejects', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockRejectedValue(new Error('GET /api/decks failed: 500'))

    const { result } = renderHook(() => useDecks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.decks).toEqual([])
    expect(result.current.error).toBe('GET /api/decks failed: 500')
  })
})

describe('useDeck', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('fetches the deck for the given slug', async () => {
    const mockDeck = { id: '1', slug: 'a', title: 'A', description: '', origin: 'official' as const, studyModes: ['practice' as const], facetDefinitions: [], locales: ['en'] }
    const spy = vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)

    const { result } = renderHook(() => useDeck('a'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(spy).toHaveBeenCalledWith('a')
    expect(result.current.deck).toEqual(mockDeck)
    expect(result.current.error).toBeNull()
  })

  test('sets deck to null without an error when the deck is not found', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    const { result } = renderHook(() => useDeck('does-not-exist'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.deck).toBeNull()
    expect(result.current.error).toBeNull()
  })

  test('re-fetches when the slug changes', async () => {
    const spy = vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    const { rerender } = renderHook(({ slug }) => useDeck(slug), { initialProps: { slug: 'a' } })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('a'))

    await act(async () => {
      rerender({ slug: 'b' })
    })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('b'))

    expect(spy).toHaveBeenCalledTimes(2)
  })
})
