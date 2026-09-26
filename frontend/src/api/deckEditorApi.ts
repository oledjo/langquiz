import type { Deck } from '../types/deck'
import type { Exercise } from '../types/exercise'
import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function authHeaders(): Record<string, string> {
  const token = readWithLegacyFallback(AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type ServerAssigned = 'id' | 'topic' | 'subtopic' | 'language'
type DistributiveEditable<T> = T extends Exercise ? Omit<T, ServerAssigned> & Partial<Pick<T, ServerAssigned>> : never

/** A question as the editor sends it: an exercise without the server-assigned fields. */
export type QuestionInput = DistributiveEditable<Exercise>

export class DeckEditorError extends Error {
  readonly status: number
  readonly index?: number

  constructor(message: string, status: number, index?: number) {
    super(message)
    this.status = status
    this.index = index
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/decks${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const payload = (await res.json().catch(() => ({}))) as { error?: string; index?: number }
  if (!res.ok) throw new DeckEditorError(payload.error ?? `${method} /api/decks${path} failed: ${res.status}`, res.status, payload.index)
  return payload as T
}

export function createDeck(input: { title: string; description?: string; language?: string }): Promise<Deck> {
  return call('POST', '', input)
}

export function updateDeck(deckId: string, input: { title?: string; description?: string }): Promise<Deck> {
  return call('PATCH', `/${deckId}`, input)
}

export function deleteDeck(deckId: string): Promise<void> {
  return call('DELETE', `/${deckId}`)
}

export function fetchDeckQuestions(deckId: string): Promise<{ deck: Deck; questions: Exercise[] }> {
  return call('GET', `/${deckId}/questions`)
}

export function addQuestions(deckId: string, questions: QuestionInput[]): Promise<{ questions: Exercise[] }> {
  return call('POST', `/${deckId}/questions`, { questions })
}

export function updateQuestion(deckId: string, exerciseId: string, question: QuestionInput): Promise<Exercise> {
  return call('PUT', `/${deckId}/questions/${encodeURIComponent(exerciseId)}`, question)
}

export function deleteQuestion(deckId: string, exerciseId: string): Promise<void> {
  return call('DELETE', `/${deckId}/questions/${encodeURIComponent(exerciseId)}`)
}

export function generateQuestions(
  deckId: string,
  input: { topic?: string; sourceText?: string; count: number; language?: string }
): Promise<{ questions: QuestionInput[]; dropped: number }> {
  return call('POST', `/${deckId}/generate`, input)
}
