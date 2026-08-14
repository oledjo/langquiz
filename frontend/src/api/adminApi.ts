import type { Exercise } from '../types/exercise'
import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function authHeaders(): Record<string, string> {
  const token = readWithLegacyFallback(AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type AdminQuestionSource = 'global' | 'user'

export interface AdminQuestion {
  recordId: number
  source: AdminQuestionSource
  ownerUserId: number | null
  ownerEmail: string | null
  exerciseId: string
  exercise: Exercise
  shareStatus?: 'private' | 'pending' | 'approved' | 'rejected'
  shareRequestedAt?: string | null
  reviewedAt?: string | null
  reviewerEmail?: string | null
  rejectionReason?: string | null
}

export interface AdminAuditEntry {
  id: number
  source: AdminQuestionSource
  recordId: number
  exerciseId: string
  action: 'approve' | 'approve_bulk' | 'reject' | 'update' | 'delete'
  note: string | null
  createdAt: string
  actorEmail: string | null
}

export async function fetchAdminQuestions(): Promise<AdminQuestion[]> {
  const res = await fetch(`${BASE_URL}/api/admin/questions`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/admin/questions failed: ${res.status}`)
  return res.json() as Promise<AdminQuestion[]>
}

export async function updateAdminQuestion(
  source: AdminQuestionSource,
  recordId: number,
  exercise: Exercise
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/questions/${source}/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ exercise }),
  })
  if (!res.ok) throw new Error(`PATCH /api/admin/questions/${source}/${recordId} failed: ${res.status}`)
}

export async function deleteAdminQuestion(source: AdminQuestionSource, recordId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/questions/${source}/${recordId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`DELETE /api/admin/questions/${source}/${recordId} failed: ${res.status}`)
}


export async function deleteAdminQuestionByExerciseId(source: AdminQuestionSource, exerciseId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/questions/${source}/by-exercise/${encodeURIComponent(exerciseId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`DELETE /api/admin/questions/${source}/by-exercise/${exerciseId} failed: ${res.status}`)
  }
}

export async function fetchShareQueue(): Promise<AdminQuestion[]> {
  const res = await fetch(`${BASE_URL}/api/admin/share-queue`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/admin/share-queue failed: ${res.status}`)
  return res.json() as Promise<AdminQuestion[]>
}

export async function approveSharedQuestion(recordId: number, note?: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/share-queue/${recordId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ note }),
  })
  if (!res.ok) throw new Error(`POST /api/admin/share-queue/${recordId}/approve failed: ${res.status}`)
}

export async function rejectSharedQuestion(recordId: number, reason: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/share-queue/${recordId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) throw new Error(`POST /api/admin/share-queue/${recordId}/reject failed: ${res.status}`)
}

export async function approveAllSharedQuestions(recordIds?: number[], note?: string): Promise<{ approved: number }> {
  const res = await fetch(`${BASE_URL}/api/admin/share-queue/approve-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ recordIds, note }),
  })
  if (!res.ok) throw new Error(`POST /api/admin/share-queue/approve-bulk failed: ${res.status}`)
  return res.json() as Promise<{ approved: number }>
}

export async function fetchAdminAuditLog(limit = 50): Promise<AdminAuditEntry[]> {
  const res = await fetch(`${BASE_URL}/api/admin/audit-log?limit=${limit}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/admin/audit-log failed: ${res.status}`)
  return res.json() as Promise<AdminAuditEntry[]>
}

export async function importEinburgertestDeck(): Promise<{ deckId: number; upserted: number }> {
  const res = await fetch(`${BASE_URL}/api/admin/decks/import-einburgertest`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`POST /api/admin/decks/import-einburgertest failed: ${res.status}`)
  return res.json() as Promise<{ deckId: number; upserted: number }>
}
