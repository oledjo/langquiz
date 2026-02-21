import { useState, useCallback, useMemo } from 'react'
import type { Exercise } from '../types/exercise'
import { postResult } from '../api/progressApi'

interface SessionResult {
  exerciseId: string
  correct: boolean
}

export function useExerciseSession(exercises: Exercise[]) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])

  const currentExercise = exercises[currentIndex] ?? null
  const isComplete = currentIndex >= exercises.length

  const handleComplete = useCallback(async (exerciseId: string, correct: boolean) => {
    setResults((prev) => [...prev, { exerciseId, correct }])
    try {
      await postResult(exerciseId, correct)
    } catch (err) {
      console.warn('Progress sync failed (backend offline?):', err)
    }
  }, [])

  const advance = useCallback(() => {
    setCurrentIndex((i) => i + 1)
  }, [])

  const restart = useCallback(() => {
    setCurrentIndex(0)
    setResults([])
  }, [])

  const score = useMemo(
    () => ({
      total: results.length,
      correct: results.filter((r) => r.correct).length,
      incorrect: results.filter((r) => !r.correct).length,
    }),
    [results]
  )

  return { currentExercise, currentIndex, isComplete, score, handleComplete, advance, restart, results }
}
