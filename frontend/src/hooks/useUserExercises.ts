import { useState, useEffect, useCallback } from 'react'
import type { Exercise } from '../types/exercise'
import {
  fetchUserExercises,
  uploadUserExercises,
  deleteUserExercisesByTopic,
  clearAllUserExercises,
} from '../api/userExercisesApi'
import { parseExercisesFromJson } from '../registry/exerciseRegistry'
import type { CustomImportResult } from '../registry/exerciseRegistry'
import { useAuth } from '../auth/AuthContext'

export function useUserExercises() {
  const { user } = useAuth()
  const [userExercises, setUserExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const exercises = await fetchUserExercises()
      setUserExercises(exercises)
    } catch (err) {
      console.warn('Failed to load user exercises:', err)
      setUserExercises([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setUserExercises([])
      setIsLoading(false)
      return
    }
    void reload()
  }, [user, reload])

  const importExercises = useCallback(
    async (jsonText: string): Promise<CustomImportResult> => {
      const { toAdd, skipped, errors } = parseExercisesFromJson(jsonText, userExercises)

      if (toAdd.length === 0) {
        return { added: 0, skipped, errors }
      }

      try {
        await uploadUserExercises(toAdd)
        setUserExercises((prev) => [...prev, ...toAdd])
        return { added: toAdd.length, skipped, errors }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.'
        return { added: 0, skipped: skipped + toAdd.length, errors: [...errors, message] }
      }
    },
    [userExercises]
  )

  const deleteByTopic = useCallback(async (topic: string): Promise<number> => {
    try {
      const result = await deleteUserExercisesByTopic(topic)
      setUserExercises((prev) => prev.filter((e) => e.topic !== topic))
      return result.deleted
    } catch (err) {
      console.warn('Failed to delete exercises by topic:', err)
      return 0
    }
  }, [])

  const clearAll = useCallback(async (): Promise<void> => {
    try {
      await clearAllUserExercises()
      setUserExercises([])
    } catch (err) {
      console.warn('Failed to clear user exercises:', err)
    }
  }, [])

  const topicCounts = userExercises.reduce<Record<string, number>>((acc, exercise) => {
    acc[exercise.topic] = (acc[exercise.topic] ?? 0) + 1
    return acc
  }, {})

  return { userExercises, isLoading, importExercises, deleteByTopic, clearAll, reload, topicCounts }
}
