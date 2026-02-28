import { useCallback, useEffect, useState } from 'react'
import { fetchAllExercisesFromApi, bootstrapExercises } from '../api/exercisesApi'
import { getBuiltInExercises } from '../registry/exerciseRegistry'
import { isValidFreeTypeExercise, normalizeExerciseMetadata, type Exercise } from '../types/exercise'
import { useAuth } from '../auth/AuthContext'

async function bootstrapInChunks(exercises: Exercise[], chunkSize = 50): Promise<void> {
  for (let i = 0; i < exercises.length; i += chunkSize) {
    const chunk = exercises.slice(i, i + chunkSize)
    await bootstrapExercises(chunk)
  }
}

export function useExercises() {
  const { user, isGuest } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    if (isGuest) {
      const builtIn = getBuiltInExercises().map((exercise) => normalizeExerciseMetadata(exercise))
      const sanitized = builtIn.filter((exercise) =>
        exercise.type === 'free-type' ? isValidFreeTypeExercise(exercise) : true
      )
      setExercises(sanitized)
      setIsLoading(false)
      return
    }

    if (!user) {
      setExercises([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      let all = await fetchAllExercisesFromApi()
      const fallbackAll = all
      const builtIn = getBuiltInExercises()
      const existingIds = new Set(all.map((exercise) => exercise.id))
      const missingBuiltIn = builtIn.filter((exercise) => !existingIds.has(exercise.id))

      // Keep DB in sync with bundled exercise packs.
      if (missingBuiltIn.length > 0) {
        try {
          await bootstrapInChunks(missingBuiltIn)
          all = await fetchAllExercisesFromApi()
        } catch (bootstrapError) {
          console.warn('Failed to bootstrap missing built-in exercises, keeping existing set:', bootstrapError)
          all = fallbackAll
        }
      }

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
