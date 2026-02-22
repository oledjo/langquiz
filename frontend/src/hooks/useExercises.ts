import { useCallback, useEffect, useState } from 'react'
import { fetchAllExercisesFromApi, bootstrapExercises } from '../api/exercisesApi'
import { getBuiltInExercises } from '../registry/exerciseRegistry'
import type { Exercise } from '../types/exercise'
import { useAuth } from '../auth/AuthContext'

export function useExercises() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) {
      setExercises([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      let all = await fetchAllExercisesFromApi()

      // One-time bootstrap so built-in sets also live in DB.
      if (all.length === 0) {
        await bootstrapExercises(getBuiltInExercises())
        all = await fetchAllExercisesFromApi()
      }

      setExercises(all)
    } catch (error) {
      console.warn('Failed to load exercises from API:', error)
      setExercises([])
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  return { exercises, isLoading, reload }
}
