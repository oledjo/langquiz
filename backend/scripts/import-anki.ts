import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import {
  toImportCandidate,
  toSchedule,
  type AnkiCard,
  type AnkiNote,
  type ImportResult,
  type ScheduleResult,
} from '../src/services/ankiImport'

export const ANKI_CONNECT_URL = 'http://127.0.0.1:8765'
export const APPROVED_DECKS = [
  'German::1. Немецкий',
  'German::2. Deutsch',
  'German::3. Goethe Institute A1 Wordlist',
] as const
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

type ReportCandidate = (ImportResult | { status: 'needs_review'; reason: string }) & {
  source: { ankiCardId: string; ankiNoteId: string; deck: string; model: string }
  schedule?: unknown
}

export type AnkiImportReport = {
  mode: 'analyze'
  importerVersion: 'anki-local-v1'
  /** Frozen so apply can re-check a new-card manifest without moving its due timestamp. */
  analyzedAt: string
  collectionCreatedAt: string | null
  sourceDecks: readonly string[]
  decks: Record<string, { noteCount: number; cardCount: number }>
  candidates: ReportCandidate[]
  unsupportedModels: string[]
  modelMetadata: Record<string, { fieldNames: string[] }>
  duplicateCandidates: string[]
  historyStatus: 'unavailable'
  manifestHash: string
}

type AnalyzeOptions = {
  ankiFetch?: FetchLike
  apiFetch?: FetchLike
  ankiUrl?: string
  now?: Date
  /** Exact collection creation instant obtained by the operator from Anki metadata. */
  collectionCreatedAt?: Date
}
type ApiOptions = { apiFetch?: FetchLike; apiUrl: string; authToken: string }

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function hash(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value), 'utf8').digest('hex')
}

function manifestOf(report: Omit<AnkiImportReport, 'manifestHash' | 'mode'>) {
  return { candidates: report.candidates, sourceDecks: report.sourceDecks, importerVersion: report.importerVersion }
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return host === 'localhost' || host === '::1' || host === '127.0.0.1'
}

function isSameAnkiEndpoint(left: URL, right: URL): boolean {
  if (left.origin === right.origin) return true
  return left.port === right.port && isLoopbackHost(left.hostname) && isLoopbackHost(right.hostname)
}

function apiBase(apiUrl: string, ankiUrl = ANKI_CONNECT_URL): string {
  const api = new URL(apiUrl)
  if (isSameAnkiEndpoint(api, new URL(ankiUrl))) throw new Error('REPS_API_URL must not point to AnkiConnect')
  return api.toString().replace(/\/$/, '')
}

async function ankiCall<T>(fetcher: FetchLike, ankiUrl: string, action: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetcher(ankiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params }),
  })
  if (!response.ok) throw new Error(`AnkiConnect ${action} failed with HTTP ${response.status}`)
  const body = await response.json() as { result?: T; error?: string | null }
  if (body.error) throw new Error(`AnkiConnect ${action} failed: ${body.error}`)
  return body.result as T
}

function cardSource(card: AnkiCard): ReportCandidate['source'] {
  return { ankiCardId: String(card.cardId), ankiNoteId: String(card.note), deck: card.deckName, model: card.modelName }
}

function candidateFrom(note: AnkiNote | undefined, card: AnkiCard, expectedDeck: string, now: Date, collectionCreatedAt?: Date): ReportCandidate {
  const source = cardSource(card)
  if (card.deckName !== expectedDeck) return { status: 'needs_review', reason: 'Card deck does not match queried source deck', source }
  if (!note) return { status: 'needs_review', reason: 'Card note was not returned by AnkiConnect', source }
  const imported = toImportCandidate(note, card)
  if (imported.status !== 'ready') return { ...imported, source }
  const schedule = toSchedule(card, now, collectionCreatedAt)
  if (schedule.status === 'needs_review') return { ...schedule, source }
  return { ...imported, source, schedule: serializeSchedule(schedule) }
}

function serializeSchedule(schedule: Exclude<ScheduleResult, { status: 'needs_review' }>) {
  return { ...schedule, dueAt: schedule.dueAt.toISOString(), lastReviewedAt: schedule.lastReviewedAt?.toISOString() ?? null }
}

/** Reads AnkiConnect only. It never mutates Anki or sends credentials to it. */
export async function analyzeAnki(options: AnalyzeOptions = {}): Promise<AnkiImportReport> {
  const ankiFetch = options.ankiFetch ?? fetch
  const ankiUrl = options.ankiUrl ?? ANKI_CONNECT_URL
  const now = options.now ?? new Date()
  const available = new Set(await ankiCall<string[]>(ankiFetch, ankiUrl, 'deckNames'))
  const decks: AnkiImportReport['decks'] = {}
  const candidates: ReportCandidate[] = []
  const modelMetadata: AnkiImportReport['modelMetadata'] = {}

  for (const deck of APPROVED_DECKS) {
    if (!available.has(deck)) {
      decks[deck] = { noteCount: 0, cardCount: 0 }
      continue
    }
    const query = `deck:${JSON.stringify(deck)}`
    const noteIds = await ankiCall<Array<string | number>>(ankiFetch, ankiUrl, 'findNotes', { query })
    const cardIds = await ankiCall<Array<string | number>>(ankiFetch, ankiUrl, 'findCards', { query })
    const notes = noteIds.length ? await ankiCall<AnkiNote[]>(ankiFetch, ankiUrl, 'notesInfo', { notes: noteIds }) : []
    const cards = cardIds.length ? await ankiCall<AnkiCard[]>(ankiFetch, ankiUrl, 'cardsInfo', { cards: cardIds }) : []
    decks[deck] = { noteCount: notes.length, cardCount: cards.length }
    const notesById = new Map(notes.map((note) => [String(note.noteId), note]))
    for (const card of cards) candidates.push(candidateFrom(notesById.get(String(card.note)), card, deck, now, options.collectionCreatedAt))
    for (const model of new Set(notes.map((note) => note.modelName))) {
      if (modelMetadata[model]) continue
      const fieldNames = await ankiCall<string[]>(ankiFetch, ankiUrl, 'modelFieldNames', { modelName: model })
      modelMetadata[model] = { fieldNames }
    }
  }

  const sourceIds = candidates.map((candidate) => candidate.source.ankiCardId)
  const duplicateCandidates = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index)
  const partial = {
    importerVersion: 'anki-local-v1' as const,
    analyzedAt: now.toISOString(),
    collectionCreatedAt: options.collectionCreatedAt?.toISOString() ?? null,
    sourceDecks: [...APPROVED_DECKS],
    decks,
    candidates,
    unsupportedModels: [...new Set(candidates.filter((item) => item.status === 'needs_review' && item.reason.includes('model')).map((item) => item.source.model))].sort(),
    modelMetadata,
    duplicateCandidates: [...new Set(duplicateCandidates)].sort(),
    historyStatus: 'unavailable' as const,
  }
  return { mode: 'analyze', ...partial, manifestHash: hash(manifestOf(partial)) }
}

function assertResponse(response: Response, action: string): Promise<unknown> {
  if (!response.ok) throw new Error(`Repzy ${action} failed with HTTP ${response.status}`)
  return response.json()
}

export async function applyAnkiReport(options: { report: AnkiImportReport; ankiFetch?: FetchLike; ankiUrl?: string; now?: Date; collectionCreatedAt?: Date } & ApiOptions): Promise<unknown> {
  const base = apiBase(options.apiUrl, options.ankiUrl)
  if (hash(manifestOf(options.report)) !== options.report.manifestHash) {
    throw new Error('Refusing apply: report manifest hash does not match report contents')
  }
  const reportNow = new Date(options.report.analyzedAt)
  if (Number.isNaN(reportNow.getTime())) throw new Error('Report has an invalid analyzedAt timestamp')
  const reportCollectionCreatedAt = options.report.collectionCreatedAt ? new Date(options.report.collectionCreatedAt) : undefined
  if (reportCollectionCreatedAt && Number.isNaN(reportCollectionCreatedAt.getTime())) throw new Error('Report has an invalid collectionCreatedAt timestamp')
  const current = await analyzeAnki({
    ankiFetch: options.ankiFetch,
    ankiUrl: options.ankiUrl,
    now: options.now ?? reportNow,
    collectionCreatedAt: options.collectionCreatedAt ?? reportCollectionCreatedAt,
  })
  if (current.manifestHash !== options.report.manifestHash) throw new Error('Refusing apply: source manifest changed since analyze')
  const apiFetch = options.apiFetch ?? fetch
  const response = await apiFetch(`${base}/api/anki-import/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${options.authToken}` },
    body: JSON.stringify({ ...manifestOf(options.report), manifestHash: options.report.manifestHash }),
  })
  return assertResponse(response, 'apply')
}

export async function verifyAnkiImport(options: { report: AnkiImportReport; runId: number } & ApiOptions): Promise<{ verified: boolean; missing: string[] }> {
  if (!Number.isSafeInteger(options.runId) || options.runId < 1) throw new Error('runId must be a positive integer')
  const apiFetch = options.apiFetch ?? fetch
  const response = await apiFetch(`${apiBase(options.apiUrl)}/api/anki-import/runs/${options.runId}/mappings`, {
    headers: { Authorization: `Bearer ${options.authToken}` },
  })
  const body = await assertResponse(response, 'verify') as { mappings?: Array<{ anki_card_id?: string; status?: string }> }
  const mapped = new Set((body.mappings ?? []).filter((mapping) => mapping.status === 'imported' || mapping.status === 'skipped_unchanged').map((mapping) => mapping.anki_card_id))
  const expected = options.report.candidates.filter((candidate) => candidate.status === 'ready').map((candidate) => candidate.source.ankiCardId)
  const missing = expected.filter((id) => !mapped.has(id))
  return { verified: missing.length === 0, missing }
}

async function readReport(reportPath: string): Promise<AnkiImportReport> {
  return JSON.parse(await fs.readFile(reportPath, 'utf8')) as AnkiImportReport
}

function envApi(): ApiOptions {
  const apiUrl = process.env.REPS_API_URL
  const authToken = process.env.REPS_AUTH_TOKEN
  if (!apiUrl || !authToken) throw new Error('REPS_API_URL and REPS_AUTH_TOKEN are required for apply or verify')
  return { apiUrl, authToken }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const reportFlag = args.indexOf('--report')
  const reportPath = reportFlag >= 0 ? args[reportFlag + 1] : 'anki-import-report.json'
  if (!reportPath) throw new Error('--report requires a path')
  const collectionCreatedAt = process.env.ANKI_COLLECTION_CREATED_AT ? new Date(process.env.ANKI_COLLECTION_CREATED_AT) : undefined
  if (collectionCreatedAt && Number.isNaN(collectionCreatedAt.getTime())) throw new Error('ANKI_COLLECTION_CREATED_AT must be an ISO timestamp')
  if (command === 'analyze') {
    const report = await analyzeAnki({ collectionCreatedAt })
    await fs.writeFile(path.resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${reportPath}: ${report.candidates.length} candidates, manifest ${report.manifestHash}`)
    return
  }
  const report = await readReport(path.resolve(reportPath))
  if (command === 'apply') {
    const result = await applyAnkiReport({ report, collectionCreatedAt, ...envApi() })
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (command === 'verify') {
    const runFlag = args.indexOf('--run-id')
    const runId = Number(args[runFlag + 1])
    const result = await verifyAnkiImport({ report, runId, ...envApi() })
    console.log(JSON.stringify(result, null, 2))
    if (!result.verified) process.exitCode = 2
    return
  }
  throw new Error('Usage: npm run import:anki -- analyze|apply|verify [--report anki-import-report.json] [--run-id ID]')
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
