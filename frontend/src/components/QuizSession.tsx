import { useEffect } from 'react'
import type { Exercise } from '../types/exercise'
import { useExerciseSession } from '../hooks/useExerciseSession'
import { QuizCard } from './QuizCard'

interface Props {
  exercises: Exercise[]
  onSessionEnd?: () => void
}

export function QuizSession({ exercises, onSessionEnd }: Props) {
  const { currentExercise, currentIndex, isComplete, score, handleComplete, advance, restart } =
    useExerciseSession(exercises)
  useEffect(() => {
    if (isComplete && onSessionEnd) onSessionEnd()
  }, [isComplete, onSessionEnd])

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
