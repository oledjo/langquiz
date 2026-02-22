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
