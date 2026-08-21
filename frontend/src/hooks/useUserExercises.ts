import { useState, useEffect, useCallback } from 'react'
import type { Exercise } from '../types/exercise'
import {
  fetchUserExercises,
  uploadUserExercises,
  deleteUserExercisesByTopic,
  clearAllUserExercises,
  requestShareAllUserExercises,
} from '../api/userExercisesApi'
import { parseExercisesFromJson } from '../lib/exerciseImport'
import type { CustomImportResult } from '../lib/exerciseImport'
import { useAuth } from '../auth/AuthContext'

export function useUserExercises() {
  const { user, isGuest } = useAuth()
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
    if (!user || isGuest) {
      setUserExercises([])
      setIsLoading(false)
      return
    }
    void reload()
  }, [isGuest, user, reload])

  // `knownExercises` is what the imported questions are deduplicated against, on top of the
  // user's own: callers pass the question banks they already hold (see ImportExercisesModal), so
  // an import that repeats an official question is still caught. It used to be checked against
  // the packs compiled into the bundle, which no longer exist client-side.
  const importExercises = useCallback(
    async (jsonText: string, knownExercises: Exercise[] = []): Promise<CustomImportResult> => {
      const { toAdd, skipped, errors } = parseExercisesFromJson(jsonText, [
        ...userExercises,
        ...knownExercises,
      ])

      if (isGuest) {
        return { added: 0, skipped: skipped + toAdd.length, errors: [...errors, 'Guest mode cannot import questions.'] }
      }

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
    [isGuest, userExercises]
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

  const shareAllForApproval = useCallback(async (): Promise<number> => {
    try {
      const result = await requestShareAllUserExercises()
      await reload()
      return result.requested
    } catch (err) {
      console.warn('Failed to share user exercises for approval:', err)
      return 0
    }
  }, [reload])

  const topicCounts = userExercises.reduce<Record<string, number>>((acc, exercise) => {
    acc[exercise.topic] = (acc[exercise.topic] ?? 0) + 1
    return acc
  }, {})

  return {
    userExercises,
    isLoading,
    importExercises,
    deleteByTopic,
    clearAll,
    shareAllForApproval,
    reload,
    topicCounts,
  }
}
