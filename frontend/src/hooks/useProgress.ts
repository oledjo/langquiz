import { useState, useEffect, useCallback } from 'react'
import { fetchProgressSummary, fetchReviewMetrics, fetchStatistics, fetchStats, postResult } from '../api/progressApi'
import type { ExerciseStats } from '../api/progressApi'
import type { ProgressSummary, ReviewMetrics, StudyStatistics } from '../api/progressApi'
import { useAuth } from '../auth/AuthContext'
import { PROGRESS_UPDATED_EVENT } from '../lib/storageKeys'

export { PROGRESS_UPDATED_EVENT }

export function emitProgressUpdated() {
  window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT))
}

/**
 * `silent: true` re-fetches without flipping `loading` back to true. Used for the refreshes
 * triggered by PROGRESS_UPDATED_EVENT, which fire while the user is mid-session: pages gate their
 * running session behind `loading`, so a visible reload after every answer would unmount the
 * session and remount it from question one.
 */
interface RefreshOptions {
  silent?: boolean
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

export function useStats(deckId?: string) {
  const { user, isGuest } = useAuth()
  const [stats, setStats] = useState<ExerciseStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (!user || isGuest) {
      setStats([])
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    if (!options?.silent) setLoading(true)
    try {
      const next = await fetchStats(deckId)
      setStats(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [deckId, isGuest, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || isGuest) return
    const handleProgressUpdated = () => {
      void refresh({ silent: true })
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

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (!user || isGuest) {
      setSummary(null)
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    if (!options?.silent) setLoading(true)
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
      void refresh({ silent: true })
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
  }, [isGuest, refresh, user])

  return { summary, loading, error, refresh }
}


export function useReviewMetrics(deckId?: string) {
  const { user, isGuest } = useAuth()
  const [metrics, setMetrics] = useState<ReviewMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (!user || isGuest) {
      setMetrics(null)
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    if (!options?.silent) setLoading(true)
    try {
      const next = await fetchReviewMetrics(deckId)
      setMetrics(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [deckId, isGuest, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || isGuest) return
    const handleProgressUpdated = () => {
      void refresh({ silent: true })
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
  }, [isGuest, refresh, user])

  return { metrics, loading, error, refresh }
}

export function useStatistics(deckId?: string) {
  const { user, isGuest } = useAuth()
  const [statistics, setStatistics] = useState<StudyStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (!user || isGuest) {
      setStatistics(null)
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    if (!options?.silent) setLoading(true)
    try {
      const next = await fetchStatistics(deckId)
      setStatistics(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [deckId, isGuest, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || isGuest) return
    const handleProgressUpdated = () => {
      void refresh({ silent: true })
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, handleProgressUpdated)
  }, [isGuest, refresh, user])

  return { statistics, loading, error, refresh }
}
