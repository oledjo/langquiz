const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const TOKEN_STORAGE_KEY = 'langquiz.auth-token'

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ExerciseStats {
  exercise_id: string
  total_attempts: number
  correct_attempts: number
  last_answered: string | null
}

export async function postResult(exerciseId: string, correct: boolean): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ exercise_id: exerciseId, correct }),
  })
  if (!res.ok) throw new Error(`POST /api/progress failed: ${res.status}`)
}

export async function fetchStats(): Promise<ExerciseStats[]> {
  const res = await fetch(`${BASE_URL}/api/stats`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/stats failed: ${res.status}`)
  return res.json() as Promise<ExerciseStats[]>
}
