import { useState, useCallback, useMemo } from 'react'
import type { Exercise, UserAnswer } from '../types/exercise'
import { postResult, type AnswerGrade } from '../api/progressApi'
import { trackEvent } from '../analytics/client'
import { useAuth } from '../auth/AuthContext'
import type { ValidationResult } from '../validators/answerValidator'
import { emitProgressUpdated } from './useProgress'

export interface SessionResult {
  exerciseId: string
  exercise: Exercise
  answer: UserAnswer
  validation: ValidationResult
  correct: boolean
}

export function useExerciseSession(exercises: Exercise[], sessionId?: string) {
  const { isGuest } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])

  const currentExercise = exercises[currentIndex] ?? null
  const isComplete = currentIndex >= exercises.length

  const handleComplete = useCallback(async (
    exercise: Exercise,
    answer: UserAnswer,
    validation: ValidationResult,
    answerGrade: AnswerGrade
  ) => {
    setResults((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        exercise,
        answer,
        validation,
        correct: validation.correct,
      },
    ])
    void trackEvent('question_answered', {
      session_id: sessionId,
      properties: {
        exercise_id: exercise.id,
        correct: validation.correct,
        answer_grade: answerGrade,
        mode: isGuest ? 'guest' : 'authenticated',
      },
    })
    if (isGuest) return
    try {
      await postResult(exercise.id, validation.correct, answerGrade)
      emitProgressUpdated()
    } catch (err) {
      console.warn('Progress sync failed (backend offline?):', err)
    }
  }, [isGuest, sessionId])

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
