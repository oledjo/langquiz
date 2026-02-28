import { useState, useEffect, useCallback } from 'react'
import { fetchProgressSummary, fetchStats, postResult } from '../api/progressApi'
import type { ExerciseStats } from '../api/progressApi'
import type { ProgressSummary } from '../api/progressApi'
import { useAuth } from '../auth/AuthContext'

export function useProgress() {
  const { isGuest } = useAuth()
  const recordResult = useCallback(async (exerciseId: string, correct: boolean) => {
    if (isGuest) return
    await postResult(exerciseId, correct)
  }, [isGuest])

  return { recordResult }
}

export function useStats() {
  const { user, isGuest } = useAuth()
  const [stats, setStats] = useState<ExerciseStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || isGuest) {
      setStats([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [isGuest, user])

  return { stats, loading, error }
}

export function useProgressSummary() {
  const { user, isGuest } = useAuth()
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || isGuest) {
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
  }, [isGuest, user])

  return { summary, loading, error }
}
