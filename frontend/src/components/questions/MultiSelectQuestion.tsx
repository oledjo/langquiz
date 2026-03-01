import { useState } from 'react'
import type { QuestionComponentProps } from './questionRegistry'
import type { MultiSelectExercise } from '../../types/exercise'

export function MultiSelectQuestion({
  exercise,
  onAnswer,
  disabled,
  validationResult,
}: QuestionComponentProps<MultiSelectExercise>) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = (index: number) => {
    if (disabled) return
    const next = new Set(selected)
    next.has(index) ? next.delete(index) : next.add(index)
    setSelected(next)
    onAnswer({ type: 'multiselect', selectedIndices: Array.from(next) })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 italic">Select all that apply</p>
      {exercise.options.map((option, i) => (
        <label
          key={i}
          className={[
            'flex items-center gap-3 p-4 rounded-xl border-2 transition-colors',
            disabled && validationResult
              ? validationResult.missedIndices?.includes(i)
                ? 'border-emerald-400 bg-emerald-50'
                : validationResult.incorrectIndices?.includes(i)
                  ? 'border-red-400 bg-red-50'
                  : selected.has(i)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white'
              : selected.has(i)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-400',
            disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          ].join(' ')}
        >
          <input
            type="checkbox"
            checked={selected.has(i)}
            onChange={() => toggle(i)}
            disabled={disabled}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="font-medium">
            {option}
            {disabled && validationResult?.missedIndices?.includes(i) && (
              <span className="ml-2 text-xs font-semibold text-emerald-700">Correct answer</span>
            )}
            {disabled && validationResult?.incorrectIndices?.includes(i) && (
              <span className="ml-2 text-xs font-semibold text-red-700">Remove this choice</span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}
