import { useCallback, useEffect, useState } from 'react'
import type { Exercise, UserAnswer } from '../types/exercise'
import { getQuestionComponent } from './questions/questionRegistry'
import { validateAnswer } from '../validators/answerValidator'
import { ResultFeedback } from './ResultFeedback'

interface Props {
  exercise: Exercise
  onComplete: (exerciseId: string, correct: boolean) => Promise<void> | void
  onNext: () => void
}

export function QuizCard({ exercise, onComplete, onNext }: Props) {
  const [currentAnswer, setCurrentAnswer] = useState<UserAnswer | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ReturnType<typeof validateAnswer> | null>(null)

  const QuestionComponent = getQuestionComponent(exercise.type)

  const canSubmit = (() => {
    if (!currentAnswer || submitted) return false
    if (currentAnswer.type === 'free-type') return currentAnswer.text.trim().length > 0
    if (currentAnswer.type === 'selection') return currentAnswer.selectedIndex >= 0
    if (currentAnswer.type === 'multiselect') return currentAnswer.selectedIndices.length > 0
    return false
  })()

  const handleSubmit = useCallback(async () => {
    if (!currentAnswer || submitted) return
    const validation = validateAnswer(exercise, currentAnswer)
    setResult(validation)
    setSubmitted(true)
    setSaving(true)
    try {
      await onComplete(exercise.id, validation.correct)
    } finally {
      setSaving(false)
    }
  }, [currentAnswer, exercise, onComplete, submitted])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'TEXTAREA') return

      if (submitted) {
        if (saving) return
        event.preventDefault()
        onNext()
        return
      }

      if (canSubmit) {
        event.preventDefault()
        handleSubmit()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canSubmit, handleSubmit, onNext, saving, submitted])

  const difficultyStars = '★'.repeat(exercise.difficulty) + '☆'.repeat(5 - exercise.difficulty)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
      <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wide">
        <span>{exercise.topic} / {exercise.subtopic}</span>
        <span title={`Difficulty ${exercise.difficulty}/5`}>{difficultyStars}</span>
      </div>

      <h2 className="text-xl font-semibold text-gray-800">{exercise.prompt}</h2>

      {exercise.context && (
        <p className="italic text-gray-500 border-l-4 border-blue-100 pl-3 py-1 bg-blue-50 rounded-r-lg">
          {exercise.context}
        </p>
      )}

      <QuestionComponent
        exercise={exercise}
        onAnswer={setCurrentAnswer}
        disabled={submitted}
      />

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={[
            'w-full py-3 rounded-xl font-semibold text-white transition-colors',
            canSubmit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed',
          ].join(' ')}
        >
          Check Answer
        </button>
      )}

      {submitted && result && (
        <>
          <ResultFeedback correct={result.correct} explanation={exercise.explanation} />
          {saving && <p className="text-sm text-gray-500 text-center">Saving answer...</p>}
          <button
            onClick={onNext}
            disabled={saving}
            className={[
              'w-full py-3 rounded-xl font-semibold text-white transition-colors',
              saving ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
            ].join(' ')}
          >
            Next question
          </button>
        </>
      )}
    </div>
  )
}
