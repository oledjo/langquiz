import type { Exercise } from '../types/exercise'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const TOKEN_STORAGE_KEY = 'langquiz.auth-token'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchUserExercises(): Promise<Exercise[]> {
  const res = await fetch(`${BASE_URL}/api/user-exercises`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/user-exercises failed: ${res.status}`)
  return res.json() as Promise<Exercise[]>
}

export async function uploadUserExercises(exercises: Exercise[]): Promise<{ added: number }> {
  const res = await fetch(`${BASE_URL}/api/user-exercises`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(exercises),
  })
  if (!res.ok) throw new Error(`POST /api/user-exercises failed: ${res.status}`)
  return res.json() as Promise<{ added: number }>
}

export async function deleteUserExercisesByTopic(topic: string): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE_URL}/api/user-exercises?topic=${encodeURIComponent(topic)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`DELETE /api/user-exercises?topic failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

export async function clearAllUserExercises(): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE_URL}/api/user-exercises/all`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`DELETE /api/user-exercises/all failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

export async function requestShareAllUserExercises(): Promise<{ requested: number }> {
  const res = await fetch(`${BASE_URL}/api/user-exercises/share-all`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`POST /api/user-exercises/share-all failed: ${res.status}`)
  return res.json() as Promise<{ requested: number }>
}
