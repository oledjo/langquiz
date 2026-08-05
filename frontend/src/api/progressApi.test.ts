import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchReviewMetrics, fetchStats, postResult } from './progressApi'

const originalFetch = globalThis.fetch

describe('postResult', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('omits mode from the request body when not provided (defaults server-side to practice)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await postResult('ex-1', true, 'good')

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.mode).toBeUndefined()
  })

  test('includes mode: "exam" in the request body when passed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await postResult('ex-1', true, 'good', 'exam')

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.mode).toBe('exam')
  })
})

describe('fetchStats', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('omits deckId from the URL when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchStats()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:3001/api/stats')
  })

  test('appends ?deckId=<id> when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchStats('1')

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:3001/api/stats?deckId=1')
  })
})

describe('fetchReviewMetrics', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('omits deckId from the URL when not provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ totals: {}, bySchedulerVersion: [] }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchReviewMetrics()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:3001/api/progress/review-metrics')
  })

  test('appends ?deckId=<id> when provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ totals: {}, bySchedulerVersion: [] }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchReviewMetrics('2')

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:3001/api/progress/review-metrics?deckId=2')
  })
})
