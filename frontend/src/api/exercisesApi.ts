import type { Exercise } from '../types/exercise'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const TOKEN_STORAGE_KEY = 'langquiz.auth-token'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchAllExercisesFromApi(): Promise<Exercise[]> {
  const res = await fetch(`${BASE_URL}/api/exercises`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/exercises failed: ${res.status}`)
  return res.json() as Promise<Exercise[]>
}

export async function bootstrapExercises(exercises: Exercise[]): Promise<{ upserted: number }> {
  const res = await fetch(`${BASE_URL}/api/exercises/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(exercises),
  })
  if (!res.ok) throw new Error(`POST /api/exercises/bootstrap failed: ${res.status}`)
  return res.json() as Promise<{ upserted: number }>
}

export async function addExerciseVote(
  exerciseId: string
): Promise<{ voteCount: number; userVoted: boolean }> {
  const res = await fetch(`${BASE_URL}/api/exercises/${encodeURIComponent(exerciseId)}/vote`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`POST /api/exercises/${exerciseId}/vote failed: ${res.status}`)
  return res.json() as Promise<{ voteCount: number; userVoted: boolean }>
}

export async function removeExerciseVote(
  exerciseId: string
): Promise<{ voteCount: number; userVoted: boolean }> {
  const res = await fetch(`${BASE_URL}/api/exercises/${encodeURIComponent(exerciseId)}/vote`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`DELETE /api/exercises/${exerciseId}/vote failed: ${res.status}`)
  return res.json() as Promise<{ voteCount: number; userVoted: boolean }>
}
