import type { Exercise } from '../types/exercise'
import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function authHeaders(): Record<string, string> {
  const token = readWithLegacyFallback(AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
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
