import { useEffect, useState } from 'react'
import { fetchExercisesForDeck } from '../api/exercisesApi'
import type { Exercise } from '../types/exercise'

export function useDeckExercises(deckId: string) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // No setLoading(true) reset here: this hook's only caller (StudySessionPage) mounts once
    // per deckId and never re-renders it with a different one, so the effect only ever runs
    // once in practice. setError(null) IS cleared on success below, though, so that IF a
    // future caller does pass a changing deckId, a stale error from a prior id can't linger
    // next to fresh, correct exercises for the new one.
    //
    // An empty deckId means the caller doesn't have a real deck yet (e.g. StudySessionPage
    // renders this hook before its own useDeck() call has resolved, passing deck?.id ?? '').
    // Skip the fetch entirely rather than hitting GET /api/exercises?deckId= with nothing to
    // filter on.
    if (!deckId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous early exit, no async work needed
      setLoading(false)
      return
    }

    let cancelled = false

    fetchExercisesForDeck(deckId)
      .then((result) => {
        if (cancelled) return
        setExercises(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load exercises.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [deckId])

  return { exercises, loading, error }
}
