import { describe, expect, test, vi } from 'vitest'
import {
  analyzeAnki,
  applyAnkiReport,
  verifyAnkiImport,
  type FetchLike,
} from './import-anki'

const allowedDecks = [
  'German::1. Немецкий',
  'German::2. Deutsch',
  'German::3. Goethe Institute A1 Wordlist',
]

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function fakeAnki(cardId = 100, deckName = allowedDecks[0]): FetchLike {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { action: string; params?: Record<string, unknown> }
    if (request.action === 'deckNames') return response({ result: allowedDecks, error: null })
    if (request.action === 'findNotes') {
      return response({ result: String(request.params?.query).includes('1.') ? [10] : [], error: null })
    }
    if (request.action === 'notesInfo') return response({ result: [{ noteId: 10, modelName: 'Basic', fields: { Front: { value: 'Haus', order: 0 }, Back: { value: 'house', order: 1 } } }], error: null })
    if (request.action === 'findCards') {
      return response({ result: String(request.params?.query).includes('1.') ? [100] : [], error: null })
    }
    if (request.action === 'cardsInfo') return response({ result: [{ cardId, note: 10, modelName: 'Basic', deckName, ord: 0, type: 0, queue: 0, due: 1, interval: 0, reps: 0, lapses: 0, factor: 2500 }], error: null })
    if (request.action === 'modelFieldNames') return response({ result: ['Front', 'Back'], error: null })
    throw new Error(`Unexpected Anki action: ${request.action}`)
  }) as FetchLike
}

describe('Anki import CLI', () => {
  test('analyzes only the approved decks and never calls the Repzy API', async () => {
    const ankiFetch = fakeAnki()
    const apiFetch = vi.fn()

    const report = await analyzeAnki({ ankiFetch, apiFetch, now: new Date('2026-09-05T10:00:00Z') })

    expect(report.mode).toBe('analyze')
    expect(report.decks['German::1. Немецкий'].cardCount).toBe(1)
    expect(report.decks['German::2. Deutsch'].cardCount).toBe(0)
    expect(report.candidates).toHaveLength(1)
    expect(report.manifestHash).toMatch(/^[a-f0-9]{64}$/)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test('refuses apply when the source manifest changed before any API request', async () => {
    const original = await analyzeAnki({ ankiFetch: fakeAnki(), now: new Date('2026-09-05T10:00:00Z') })
    const changedAnki = fakeAnki(101)
    const apiFetch = vi.fn()

    await expect(applyAnkiReport({ report: original, ankiFetch: changedAnki, apiFetch, apiUrl: 'https://repzy.test', authToken: 'secret' }))
      .rejects.toThrow('source manifest changed')
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test('sends the auth token only to the configured Repzy API when applying an unchanged report', async () => {
    const ankiFetch = fakeAnki()
    const report = await analyzeAnki({ ankiFetch, now: new Date('2026-09-05T10:00:00Z') })
    const apiFetch = vi.fn(async () => response({ id: 7, manifest_hash: report.manifestHash })) as unknown as FetchLike

    await applyAnkiReport({ report, ankiFetch: fakeAnki(), apiFetch, apiUrl: 'https://repzy.test/', authToken: 'secret', now: new Date('2026-09-05T10:00:00Z') })

    expect(apiFetch).toHaveBeenCalledWith('https://repzy.test/api/anki-import/apply', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
    }))
    for (const call of (ankiFetch as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[1]?.headers).not.toMatchObject({ Authorization: expect.anything() })
    }
  })

  test('rejects AnkiConnect loopback aliases before sending the token', async () => {
    const report = await analyzeAnki({ ankiFetch: fakeAnki(), now: new Date('2026-09-05T10:00:00Z') })
    const ankiFetch = vi.fn()
    const apiFetch = vi.fn()

    await expect(applyAnkiReport({ report, ankiFetch, apiFetch, apiUrl: 'http://localhost:8765', authToken: 'secret' }))
      .rejects.toThrow('AnkiConnect')
    expect(ankiFetch).not.toHaveBeenCalled()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test('rejects a tampered report before re-reading Anki or calling Repzy', async () => {
    const report = await analyzeAnki({ ankiFetch: fakeAnki(), now: new Date('2026-09-05T10:00:00Z') })
    const ankiFetch = vi.fn()
    const apiFetch = vi.fn()

    await expect(applyAnkiReport({ report: { ...report, candidates: [] }, ankiFetch, apiFetch, apiUrl: 'https://repzy.test', authToken: 'secret' }))
      .rejects.toThrow('report manifest hash')
    expect(ankiFetch).not.toHaveBeenCalled()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test('marks cards returned outside their queried deck as needs review', async () => {
    const report = await analyzeAnki({ ankiFetch: fakeAnki(100, 'German::outside'), now: new Date('2026-09-05T10:00:00Z') })

    expect(report.candidates).toEqual([expect.objectContaining({
      status: 'needs_review',
      reason: 'Card deck does not match queried source deck',
      source: expect.objectContaining({ deck: 'German::outside' }),
    })])
  })

  test('verifies imported source ids and statuses against user-scoped mappings', async () => {
    const report = await analyzeAnki({ ankiFetch: fakeAnki(), now: new Date('2026-09-05T10:00:00Z') })
    const apiFetch = vi.fn(async () => response({ mappings: [{ anki_card_id: '100', status: 'imported' }] })) as unknown as FetchLike

    const result = await verifyAnkiImport({ report, runId: 7, apiFetch, apiUrl: 'https://repzy.test', authToken: 'secret' })

    expect(result.verified).toBe(true)
    expect(apiFetch).toHaveBeenCalledWith('https://repzy.test/api/anki-import/runs/7/mappings', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
    }))
  })

  test('runs the deterministic analyze, human-confirmed apply, and verify path without mutating Anki', async () => {
    const ankiFetch = fakeAnki()
    const apiFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/anki-import/apply')) return response({ id: 7 })
      if (url.endsWith('/api/anki-import/runs/7/mappings')) {
        return response({ mappings: [{ anki_card_id: '100', status: 'imported' }] })
      }
      throw new Error(`Unexpected Repzy URL: ${url}`)
    }) as unknown as FetchLike

    const report = await analyzeAnki({ ankiFetch, now: new Date('2026-09-05T10:00:00Z') })
    await applyAnkiReport({
      report,
      ankiFetch,
      apiFetch,
      apiUrl: 'https://repzy.test',
      authToken: 'test-token',
      now: new Date('2026-09-05T10:00:00Z'),
    })
    const verification = await verifyAnkiImport({ report, runId: 7, apiFetch, apiUrl: 'https://repzy.test', authToken: 'test-token' })

    expect(verification).toEqual({ verified: true, missing: [] })
    const ankiActions = (ankiFetch as ReturnType<typeof vi.fn>).mock.calls.map(([, init]) => {
      return JSON.parse(String((init as RequestInit).body)).action
    })
    expect(ankiActions).toEqual(expect.arrayContaining(['deckNames', 'findNotes', 'findCards', 'notesInfo', 'cardsInfo', 'modelFieldNames']))
    for (const mutationAction of ['addNote', 'updateNoteFields', 'answerCards', 'deleteNotes']) {
      expect(ankiActions).not.toContain(mutationAction)
    }
    for (const [, init] of (ankiFetch as ReturnType<typeof vi.fn>).mock.calls) {
      expect((init as RequestInit).headers).not.toMatchObject({ Authorization: expect.anything() })
    }
    expect(apiFetch).toHaveBeenCalledTimes(2)
    for (const [url, init] of (apiFetch as ReturnType<typeof vi.fn>).mock.calls) {
      expect(url).toMatch(/^https:\/\/repzy\.test\//)
      expect((init as RequestInit | undefined)?.headers).toMatchObject({ Authorization: 'Bearer test-token' })
    }
  })
})
