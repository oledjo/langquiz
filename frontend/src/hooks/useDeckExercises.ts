import { useEffect, useState } from 'react'
import { fetchExercisesForDeck } from '../api/exercisesApi'
import type { Exercise } from '../types/exercise'

export function useDeckExercises(deckId: string) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // This effect's dependency (deckId) DOES change during this hook's real lifecycle: its
    // caller (StudySessionPage) renders it with '' before its own useDeck() call resolves, then
    // re-renders with the real deck id once it does. So, like useDeck in useDecks.ts (not a
    // one-time synchronous derivation), loading/error must reset on every run — otherwise the
    // empty-deckId run's `loading: false` would leak into the real fetch's in-flight window and
    // the page would flash "no exercises" before the real ones load.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for a new deckId, not a synchronous derivation
    setLoading(true)
    setError(null)

    // An empty deckId means the caller doesn't have a real deck yet (e.g. StudySessionPage
    // renders this hook before its own useDeck() call has resolved, passing deck?.id ?? '').
    // Skip the fetch entirely rather than hitting GET /api/exercises?deckId= with nothing to
    // filter on. loading stays true here (not false) so the caller's own loading flag - which
    // for StudySessionPage is `deckLoading || (Boolean(deck) && exercisesLoading)` - doesn't
    // matter yet either way: deck is still null while deckId is '', so that expression is
    // already driven by deckLoading alone at this point.
    if (!deckId) return

    let cancelled = false

    fetchExercisesForDeck(deckId)
      .then((result) => {
        if (cancelled) return
        setExercises(result)
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
