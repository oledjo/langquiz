import { useState } from 'react'
import type { QuestionComponentProps } from './questionRegistry'
import type { SelectionExercise } from '../../types/exercise'

export function SelectionQuestion({
  exercise,
  onAnswer,
  disabled,
  validationResult,
}: QuestionComponentProps<SelectionExercise>) {
  const [selected, setSelected] = useState<number | null>(null)

  const handleSelect = (index: number) => {
    if (disabled) return
    setSelected(index)
    onAnswer({ type: 'selection', selectedIndex: index })
  }

  // Once answered, reveal the correct option (green) even if the user picked a different one
  // (red) — matches MultiSelectQuestion's existing correct/incorrect styling.
  const showValidation = disabled && Boolean(validationResult)

  return (
    <div className="grid grid-cols-1 gap-3">
      {exercise.options.map((option, i) => {
        const isCorrectOption = i === exercise.answer
        const isSelected = selected === i

        return (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={disabled}
            className={[
              'p-4 rounded-xl border-2 text-left transition-colors font-medium',
              showValidation
                ? isCorrectOption
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                  : isSelected
                    ? 'border-red-400 bg-red-50 text-red-900'
                    : 'border-gray-200 bg-white'
                : isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white hover:border-gray-400',
              disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
            ].join(' ')}
          >
            {option}
            {showValidation && isCorrectOption && !isSelected && (
              <span className="ml-2 text-xs font-semibold text-emerald-700">Correct answer</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
