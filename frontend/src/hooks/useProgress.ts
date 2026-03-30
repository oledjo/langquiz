import { useState, useEffect, useCallback } from 'react'
import { fetchProgressSummary, fetchStats, postResult } from '../api/progressApi'
import type { ExerciseStats } from '../api/progressApi'
import type { ProgressSummary } from '../api/progressApi'
import { useAuth } from '../auth/AuthContext'

export const PROGRESS_UPDATED_EVENT = 'langquiz:progress-updated'

export function emitProgressUpdated() {
  window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT))
}

export function useProgress() {
  const { isGuest } = useAuth()
  const recordResult = useCallback(async (exerciseId: string, correct: boolean) => {
    if (isGuest) return
    await postResult(exerciseId, correct, correct ? 'good' : 'again')
    emitProgressUpdated()
  }, [isGuest])

  return { recordResult }
}

export function useStats() {
  const { user, isGuest } = useAuth()
  const [stats, setStats] = useState<ExerciseStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || isGuest) {
      setStats([])
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const next = await fetchStats()
      setStats(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [isGuest, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || isGuest) return
    const handleProgressUpdated = () => {
      void refresh()
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
  }, [isGuest, refresh, user])

  return { stats, loading, error, refresh }
}

export function useProgressSummary() {
  const { user, isGuest } = useAuth()
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || isGuest) {
      setSummary(null)
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const next = await fetchProgressSummary()
      setSummary(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [isGuest, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || isGuest) return
    const handleProgressUpdated = () => {
      void refresh()
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
  }, [isGuest, refresh, user])

  return { summary, loading, error, refresh }
}
