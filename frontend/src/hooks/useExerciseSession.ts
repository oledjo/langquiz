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
  // Snapshotted at mount and then fixed for the whole session, rather than read live from the
  // `exercises` prop. Callers derive that prop from progress stats (untried-only practice, due
  // reviews) and answering a question re-fetches those stats, so a moment later the caller hands
  // over a list that no longer contains the question just answered. Indexing into that shifted
  // list swaps the question already on screen for the following one — a question flashes up for
  // about a second, is replaced, and never gets asked. `restart` deliberately replays this
  // snapshot too, so "Try Again" repeats the session the user just did.
  //
  // Callers must therefore mount this hook with the list they intend to run (both of them wait
  // for their fetches before rendering QuizSession); a later prop change is ignored by design.
  const [sessionExercises] = useState<Exercise[]>(exercises)

  const currentExercise = sessionExercises[currentIndex] ?? null
  const isComplete = sessionExercises.length > 0 && currentIndex >= sessionExercises.length

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

  return {
    exercises: sessionExercises,
    currentExercise,
    currentIndex,
    isComplete,
    score,
    handleComplete,
    advance,
    restart,
    results,
  }
}
