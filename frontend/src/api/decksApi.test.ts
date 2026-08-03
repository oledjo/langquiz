import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchDeckBySlug, fetchDecks } from './decksApi'

const originalFetch = globalThis.fetch

describe('decksApi', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('fetchDecks calls GET /api/decks and returns the parsed array', async () => {
    const mockDecks = [
      { id: '1', slug: 'german-grammar-vocabulary', title: 'German', description: '', origin: 'official', studyModes: ['practice'], facetDefinitions: [], locales: ['en'] },
    ]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDecks),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchDecks()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/decks$/),
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toEqual(mockDecks)
  })

  test('fetchDecks throws on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    await expect(fetchDecks()).rejects.toThrow('GET /api/decks failed: 500')
  })

  test('fetchDeckBySlug calls GET /api/decks/:slug and returns the parsed deck', async () => {
    const mockDeck = { id: '1', slug: 'german-grammar-vocabulary', title: 'German', description: '', origin: 'official', studyModes: ['practice'], facetDefinitions: [], locales: ['en'] }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDeck),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchDeckBySlug('german-grammar-vocabulary')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/decks\/german-grammar-vocabulary$/),
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toEqual(mockDeck)
  })

  test('fetchDeckBySlug returns null on a 404 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch

    const result = await fetchDeckBySlug('does-not-exist')

    expect(result).toBeNull()
  })

  test('fetchDeckBySlug throws on a non-404 error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    await expect(fetchDeckBySlug('german-grammar-vocabulary')).rejects.toThrow(
      'GET /api/decks/german-grammar-vocabulary failed: 500'
    )
  })

  test('fetchDeckBySlug URL-encodes the slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchDeckBySlug('a slug/with special?chars')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('a slug/with special?chars')),
      expect.anything()
    )
  })
})
