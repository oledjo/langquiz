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

function fakeAnki(cardId = 100): FetchLike {
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
    if (request.action === 'cardsInfo') return response({ result: [{ cardId, note: 10, modelName: 'Basic', deckName: allowedDecks[0], ord: 0, type: 0, queue: 0, due: 1, interval: 0, reps: 0, lapses: 0, factor: 2500 }], error: null })
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

  test('verifies imported source ids and statuses against user-scoped mappings', async () => {
    const report = await analyzeAnki({ ankiFetch: fakeAnki(), now: new Date('2026-09-05T10:00:00Z') })
    const apiFetch = vi.fn(async () => response({ mappings: [{ anki_card_id: '100', status: 'imported' }] })) as unknown as FetchLike

    const result = await verifyAnkiImport({ report, runId: 7, apiFetch, apiUrl: 'https://repzy.test', authToken: 'secret' })

    expect(result.verified).toBe(true)
    expect(apiFetch).toHaveBeenCalledWith('https://repzy.test/api/anki-import/runs/7/mappings', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
    }))
  })
})
