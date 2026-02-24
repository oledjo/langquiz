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

export interface PeriodStats {
  total: number
  correct: number
}

export interface ProgressBarPoint {
  day: string
  total: number
  correct: number
}

export interface ProgressSummary {
  day: PeriodStats
  week: PeriodStats
  month: PeriodStats
  bars: ProgressBarPoint[]
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function buildFallbackBars(days = 14): ProgressBarPoint[] {
  const result: ProgressBarPoint[] = []
  const current = new Date()
  current.setHours(0, 0, 0, 0)

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(current)
    d.setDate(current.getDate() - i)
    result.push({
      day: d.toISOString().slice(0, 10),
      total: 0,
      correct: 0,
    })
  }
  return result
}

function normalizeSummaryPayload(payload: unknown): ProgressSummary {
  const fallback: ProgressSummary = {
    day: { total: 0, correct: 0 },
    week: { total: 0, correct: 0 },
    month: { total: 0, correct: 0 },
    bars: buildFallbackBars(14),
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback
  const raw = payload as Record<string, unknown>

  const normalizedBars = Array.isArray(raw.bars)
    ? raw.bars
        .filter((bar) => bar && typeof bar === 'object')
        .map((bar) => {
          const b = bar as Record<string, unknown>
          return {
            day: typeof b.day === 'string' ? b.day : '',
            total: toNumber(b.total),
            correct: toNumber(b.correct),
          }
        })
        .filter((bar) => bar.day.length > 0)
    : []

  function normalizePeriod(input: unknown): PeriodStats {
    if (!input || typeof input !== 'object') return { total: 0, correct: 0 }
    const p = input as Record<string, unknown>
    return { total: toNumber(p.total), correct: toNumber(p.correct) }
  }

  return {
    day: normalizePeriod(raw.day),
    week: normalizePeriod(raw.week),
    month: normalizePeriod(raw.month),
    bars: normalizedBars.length > 0 ? normalizedBars : buildFallbackBars(14),
  }
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

export async function fetchProgressSummary(): Promise<ProgressSummary> {
  const res = await fetch(`${BASE_URL}/api/progress/summary`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/progress/summary failed: ${res.status}`)
  const payload = (await res.json()) as unknown
  return normalizeSummaryPayload(payload)
}
