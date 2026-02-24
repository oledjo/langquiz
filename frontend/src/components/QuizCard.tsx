import { useCallback, useEffect, useState } from 'react'
import type { Exercise, UserAnswer } from '../types/exercise'
import { getQuestionComponent } from './questions/questionRegistry'
import { validateAnswer } from '../validators/answerValidator'

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
  const [showGrammarNote, setShowGrammarNote] = useState(false)

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
    setShowGrammarNote(false)
  }, [exercise.id])

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
  const selectedOptionLabel =
    submitted &&
    currentAnswer?.type === 'selection' &&
    exercise.type === 'selection' &&
    currentAnswer.selectedIndex >= 0
      ? exercise.options[currentAnswer.selectedIndex]
      : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
      <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wide">
        <span>
          {exercise.topic} / {exercise.subtopic}
          {exercise.group ? ` · ${exercise.group}` : ''}
          {exercise.level ? ` · ${exercise.level}` : ''}
        </span>
        <span title={`Difficulty ${exercise.difficulty}/5`}>{difficultyStars}</span>
      </div>

      <h2 className="text-xl font-semibold text-gray-800">{exercise.prompt}</h2>

      {exercise.context && (
        <p className="italic text-gray-500 border-l-4 border-blue-100 pl-3 py-1 bg-blue-50 rounded-r-lg">
          {exercise.context}
        </p>
      )}

      {exercise.grammarNote && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowGrammarNote((prev) => !prev)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            {showGrammarNote ? 'Hide grammar cheat sheet' : 'Show grammar cheat sheet'}
          </button>
          {showGrammarNote && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-900">
              {exercise.grammarNote}
            </div>
          )}
        </div>
      )}

      <div className={submitted && result ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]' : ''}>
        <QuestionComponent
          exercise={exercise}
          onAnswer={setCurrentAnswer}
          disabled={submitted}
        />

        {submitted && result && (
          <aside
            className={[
              'rounded-xl p-4 space-y-2 border-2 h-fit',
              result.correct
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-800',
            ].join(' ')}
          >
            <p className="font-semibold text-lg">{result.correct ? 'Correct!' : 'Not quite.'}</p>
            {selectedOptionLabel && (
              <p className="text-sm opacity-90">
                <span className="font-semibold">Selected:</span> {selectedOptionLabel}
              </p>
            )}
            {exercise.explanation && <p className="text-sm opacity-90">{exercise.explanation}</p>}
          </aside>
        )}
      </div>

      <div className="min-h-[76px] flex flex-col justify-end gap-2">
        {saving && <p className="text-sm text-gray-500 text-center">Saving answer...</p>}
        {!submitted ? (
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
        ) : (
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
        )}
      </div>
    </div>
  )
}
