import { useCallback, useEffect, useState } from 'react'
import type { Exercise, UserAnswer } from '../types/exercise'
import { getQuestionComponent } from './questions/questionRegistry'
import { validateAnswer, type ValidationResult } from '../validators/answerValidator'
import { addExerciseVote, removeExerciseVote } from '../api/exercisesApi'

interface Props {
  exercise: Exercise
  onComplete: (
    exercise: Exercise,
    answer: UserAnswer,
    validation: ValidationResult
  ) => Promise<void> | void
  onNext: () => void
}

export function QuizCard({ exercise, onComplete, onNext }: Props) {
  const [currentAnswer, setCurrentAnswer] = useState<UserAnswer | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ReturnType<typeof validateAnswer> | null>(null)
  const [showGrammarNote, setShowGrammarNote] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [voteBusy, setVoteBusy] = useState(false)
  const [voteCount, setVoteCount] = useState(exercise.voteCount ?? 0)
  const [userVoted, setUserVoted] = useState(Boolean(exercise.userVoted))

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
      await onComplete(exercise, currentAnswer, validation)
    } finally {
      setSaving(false)
    }
  }, [currentAnswer, exercise, onComplete, submitted])

  useEffect(() => {
    setShowHint(false)
    setShowGrammarNote(false)
    setVoteBusy(false)
    setVoteCount(exercise.voteCount ?? 0)
    setUserVoted(Boolean(exercise.userVoted))
  }, [exercise.id])

  const toggleVote = useCallback(async () => {
    if (voteBusy) return
    setVoteBusy(true)
    try {
      if (userVoted) {
        const result = await removeExerciseVote(exercise.id)
        setVoteCount(result.voteCount)
        setUserVoted(result.userVoted)
      } else {
        const result = await addExerciseVote(exercise.id)
        setVoteCount(result.voteCount)
        setUserVoted(result.userVoted)
      }
    } finally {
      setVoteBusy(false)
    }
  }, [exercise.id, userVoted, voteBusy])

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
          {exercise.isUserAdded ? ' · user-added' : ''}
          {exercise.isUserAdded && exercise.shareStatus ? ` · ${exercise.shareStatus}` : ''}
        </span>
        <span title={`Difficulty ${exercise.difficulty}/5`}>{difficultyStars}</span>
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={toggleVote}
          disabled={voteBusy}
          className={[
            'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
            userVoted
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700',
            voteBusy ? 'cursor-not-allowed opacity-70' : '',
          ].join(' ')}
          title={userVoted ? 'Remove vote' : 'Upvote this question'}
        >
          {userVoted ? 'Voted' : 'Vote'} · {voteCount}
        </button>
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

      {exercise.hint && !submitted && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowHint((prev) => !prev)}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
          >
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
          {showHint && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm text-amber-900">
              {exercise.hint}
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
