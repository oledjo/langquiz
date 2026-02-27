import { useEffect } from 'react'
import { useState } from 'react'
import type { Exercise } from '../types/exercise'
import { useExerciseSession } from '../hooks/useExerciseSession'
import { QuizCard } from './QuizCard'
import { trackEvent } from '../analytics/client'

interface Props {
  exercises: Exercise[]
  onSessionEnd?: () => void
  sessionId?: string
}

export function QuizSession({ exercises, onSessionEnd, sessionId }: Props) {
  const { currentExercise, currentIndex, isComplete, score, handleComplete, advance, restart } =
    useExerciseSession(exercises, sessionId)
  const [shareMessage, setShareMessage] = useState('')
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

  if (isComplete) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    const referralUrl = `${window.location.origin}/?utm_source=referral&utm_medium=share&utm_campaign=referral_v1`
    return (
      <div className="text-center py-16 space-y-4">
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
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          Exercise {currentIndex + 1} of {exercises.length}
        </span>
        <span className="text-green-600 font-medium">{score.correct} correct</span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIndex) / exercises.length) * 100}%` }}
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
