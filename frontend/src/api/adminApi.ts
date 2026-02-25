import type { Exercise } from '../types/exercise'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const TOKEN_STORAGE_KEY = 'langquiz.auth-token'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
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

export async function fetchShareQueue(): Promise<AdminQuestion[]> {
  const res = await fetch(`${BASE_URL}/api/admin/share-queue`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/admin/share-queue failed: ${res.status}`)
  return res.json() as Promise<AdminQuestion[]>
}

export async function approveSharedQuestion(recordId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/share-queue/${recordId}/approve`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`POST /api/admin/share-queue/${recordId}/approve failed: ${res.status}`)
}

export async function rejectSharedQuestion(recordId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/share-queue/${recordId}/reject`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`POST /api/admin/share-queue/${recordId}/reject failed: ${res.status}`)
}
