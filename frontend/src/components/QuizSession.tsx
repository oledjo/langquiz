import { useEffect } from 'react'
import { useState } from 'react'
import type { Exercise, UserAnswer } from '../types/exercise'
import { useExerciseSession } from '../hooks/useExerciseSession'
import { useAuth } from '../auth/AuthContext'
import { deleteAdminQuestionByExerciseId } from '../api/adminApi'
import { QuizCard } from './QuizCard'
import { trackEvent } from '../analytics/client'
import type { ValidationResult } from '../validators/answerValidator'

interface Props {
  exercises: Exercise[]
  onSessionEnd?: () => void
  onExit?: () => void
  sessionId?: string
  onQuestionDeleted?: (exerciseId: string) => Promise<void> | void
}

export function QuizSession({ exercises, onSessionEnd, onExit, sessionId, onQuestionDeleted }: Props) {
  const { isGuest, user } = useAuth()
  const { currentExercise, currentIndex, isComplete, score, handleComplete, advance, restart, results } =
    useExerciseSession(exercises, sessionId)
  const [shareMessage, setShareMessage] = useState('')
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false)
  useEffect(() => {
    if (isComplete && onSessionEnd) onSessionEnd()
  }, [isComplete, onSessionEnd])

  useEffect(() => {
    if (!isComplete || score.total === 0) return
    const pct = Math.round((score.correct / score.total) * 100)
    void trackEvent('session_completed', {
      session_id: sessionId,
      properties: {
        total: score.total,
        correct: score.correct,
        incorrect: score.incorrect,
        accuracy_pct: pct,
      },
    })
  }, [isComplete, score.correct, score.incorrect, score.total, sessionId])

  if (exercises.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg">No exercises match the current filters.</p>
        <p className="text-sm mt-1">Try changing the topic or difficulty.</p>
      </div>
    )
  }

  const handleDeleteCurrentQuestion = async () => {
    if (!currentExercise || isDeletingQuestion || user?.role !== 'admin') return
    const source = currentExercise.isUserAdded ? 'user' : 'global'
    const confirmed = window.confirm('Delete this question? This action cannot be undone.')
    if (!confirmed) return

    setIsDeletingQuestion(true)
    try {
      await deleteAdminQuestionByExerciseId(source, currentExercise.id)
      await onQuestionDeleted?.(currentExercise.id)
      window.alert('Question deleted.')
    } catch {
      window.alert('Could not delete question. Please try again.')
    } finally {
      setIsDeletingQuestion(false)
    }
  }

  const handleExit = () => {
    const message = isGuest
      ? 'Exit this guest session? Your current trial progress will be discarded.'
      : 'Exit this session? Answers you already submitted stay saved, but this session will close.'
    if (!window.confirm(message)) return
    onExit?.()
  }

  if (isComplete) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    const referralUrl = `${window.location.origin}/?utm_source=referral&utm_medium=share&utm_campaign=referral_v1`
    const incorrectResults = results.filter((result) => !result.correct)
    return (
      <div className="space-y-6 py-10">
        <div className="text-center space-y-4">
          <div className="text-5xl">{pct >= 70 ? '🎉' : '📚'}</div>
          <h2 className="text-2xl font-bold text-gray-800">Session Complete!</h2>
          <p className="text-gray-600">
            You got{' '}
            <span className={pct >= 70 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
              {score.correct} of {score.total}
            </span>{' '}
            correct ({pct}%)
          </p>
          <button
            onClick={restart}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
          >
            Try Again
          </button>
        </div>

        {incorrectResults.length > 0 && (
          <section className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Review missed questions</h3>
              <p className="text-sm text-slate-600">
                Review the questions you missed before starting another session.
              </p>
            </div>
            <div className="space-y-4">
              {incorrectResults.map((result, index) => (
                <article
                  key={`${result.exerciseId}-${index}`}
                  className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-slate-400">
                    <span>
                      {result.exercise.topic} / {result.exercise.subtopic}
                    </span>
                    <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-600">
                      Incorrect
                    </span>
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-slate-900">{result.exercise.prompt}</h4>
                  {result.exercise.context && (
                    <p className="mt-2 rounded-r-lg border-l-4 border-slate-200 bg-slate-50 px-3 py-2 text-sm italic text-slate-600">
                      {result.exercise.context}
                    </p>
                  )}
                  <dl className="mt-4 space-y-3 text-sm text-slate-700">
                    <div>
                      <dt className="font-semibold text-slate-900">Your answer</dt>
                      <dd>{formatUserAnswer(result.exercise, result.answer)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-900">Correct answer</dt>
                      <dd>{formatCorrectAnswer(result.exercise, result.validation)}</dd>
                    </div>
                    {result.exercise.explanation && (
                      <div>
                        <dt className="font-semibold text-slate-900">Explanation</dt>
                        <dd>{result.exercise.explanation}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mx-auto max-w-xl rounded-xl border border-blue-100 bg-blue-50 p-4 text-left">
          <h3 className="text-sm font-semibold text-slate-800">Share your progress</h3>
          <p className="mt-1 text-xs text-slate-600">
            Invite a friend with your referral link. You both unlock an extra curated session pack after activation.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={referralUrl}
              className="flex-1 min-w-[240px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600"
            />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(referralUrl)
                  setShareMessage('Referral link copied.')
                } catch {
                  setShareMessage('Could not copy link. Copy manually.')
                }
              }}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900"
            >
              Copy link
            </button>
          </div>
          {shareMessage && <p className="mt-2 text-xs text-blue-700">{shareMessage}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
        <span>
          Exercise {currentIndex + 1} of {exercises.length}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-green-600 font-medium">{score.correct} correct</span>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => {
                void handleDeleteCurrentQuestion()
              }}
              disabled={isDeletingQuestion}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeletingQuestion ? 'Deleting…' : 'Delete question'}
            </button>
          )}
          <button
            type="button"
            onClick={handleExit}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-300 hover:text-red-700"
          >
            Exit session
          </button>
        </div>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / exercises.length) * 100}%` }}
        />
      </div>

      <QuizCard
        key={currentExercise!.id}
        exercise={currentExercise!}
        onComplete={handleComplete}
        onNext={advance}
      />
    </div>
  )
}

function formatUserAnswer(exercise: Exercise, answer: UserAnswer): string {
  if (exercise.type === 'selection' && answer.type === 'selection') {
    return exercise.options[answer.selectedIndex] ?? 'No answer'
  }
  if (exercise.type === 'multiselect' && answer.type === 'multiselect') {
    if (answer.selectedIndices.length === 0) return 'No answer'
    return answer.selectedIndices
      .map((index) => exercise.options[index])
      .filter(Boolean)
      .join(', ')
  }
  if (exercise.type === 'free-type' && answer.type === 'free-type') {
    return answer.text.trim() || 'No answer'
  }
  return 'No answer'
}

function formatCorrectAnswer(exercise: Exercise, validation: ValidationResult): string {
  if (exercise.type === 'selection') {
    return exercise.options[exercise.answer] ?? 'Unknown'
  }
  if (exercise.type === 'multiselect') {
    const labels = exercise.answers.map((index) => exercise.options[index]).filter(Boolean)
    if (labels.length === 0) return 'Unknown'
    const missed = (validation.missedIndices ?? [])
      .map((index) => exercise.options[index])
      .filter(Boolean)
    const incorrect = (validation.incorrectIndices ?? [])
      .map((index) => exercise.options[index])
      .filter(Boolean)

    if (missed.length === 0 && incorrect.length === 0) {
      return labels.join(', ')
    }

    const notes = []
    if (missed.length > 0) notes.push(`missed: ${missed.join(', ')}`)
    if (incorrect.length > 0) notes.push(`incorrect picks: ${incorrect.join(', ')}`)
    return `${labels.join(', ')} (${notes.join('; ')})`
  }
  return exercise.answers.join(' / ')
}
