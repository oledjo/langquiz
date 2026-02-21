import { useState, useEffect, useCallback } from 'react'
import { fetchStats, postResult } from '../api/progressApi'
import type { ExerciseStats } from '../api/progressApi'

export function useProgress() {
  const recordResult = useCallback(async (exerciseId: string, correct: boolean) => {
    await postResult(exerciseId, correct)
  }, [])

  return { recordResult }
}

export function useStats() {
  const [stats, setStats] = useState<ExerciseStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading, error }
}
