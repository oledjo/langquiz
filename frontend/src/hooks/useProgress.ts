import { useState, useEffect, useCallback } from 'react'
import { fetchProgressSummary, fetchStats, postResult } from '../api/progressApi'
import type { ExerciseStats } from '../api/progressApi'
import type { ProgressSummary } from '../api/progressApi'
import { useAuth } from '../auth/AuthContext'

export function useProgress() {
  const recordResult = useCallback(async (exerciseId: string, correct: boolean) => {
    await postResult(exerciseId, correct)
  }, [])

  return { recordResult }
}

export function useStats() {
  const { user } = useAuth()
  const [stats, setStats] = useState<ExerciseStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setStats([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [user])

  return { stats, loading, error }
}

export function useProgressSummary() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setSummary(null)
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    fetchProgressSummary()
      .then(setSummary)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [user])

  return { summary, loading, error }
}
