import { useCallback, useEffect, useState } from 'react'
import { fetchAllExercisesFromApi } from '../api/exercisesApi'
import { isValidFreeTypeExercise, normalizeExerciseMetadata, type Exercise } from '../types/exercise'
import { useAuth } from '../auth/AuthContext'

/**
 * Every question the signed-in user can practice, across all decks: the official banks plus
 * their own imported ones. The backend is the only source — the bundled packs live in Postgres
 * (seeded by `backend/npm run seed:exercises`), not in this bundle.
 *
 * Guests fetch nothing: the only consumer of this list is the cross-deck due-review section,
 * which needs review history a guest doesn't have. Guests browse decks through
 * `useDeckExercises`, which reads the same API anonymously.
 */
export function useExercises() {
  const { user, isGuest } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user || isGuest) {
      setExercises([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const all = await fetchAllExercisesFromApi()
      const normalized = all.map((exercise) => normalizeExerciseMetadata(exercise))
      const sanitized = normalized.filter((exercise) =>
        exercise.type === 'free-type' ? isValidFreeTypeExercise(exercise) : true
      )
      setExercises(sanitized)
    } catch (error) {
      console.warn('Failed to load exercises from API:', error)
      setExercises([])
    } finally {
      setIsLoading(false)
    }
  }, [isGuest, user])

  useEffect(() => {
    void reload()
  }, [reload])

  return { exercises, isLoading, reload }
}
