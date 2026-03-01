import { useState } from 'react'
import type { QuestionComponentProps } from './questionRegistry'
import type { SelectionExercise } from '../../types/exercise'

export function SelectionQuestion({
  exercise,
  onAnswer,
  disabled,
  validationResult: _validationResult,
}: QuestionComponentProps<SelectionExercise>) {
  const [selected, setSelected] = useState<number | null>(null)

  const handleSelect = (index: number) => {
    if (disabled) return
    setSelected(index)
    onAnswer({ type: 'selection', selectedIndex: index })
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {exercise.options.map((option, i) => (
        <button
          key={i}
          onClick={() => handleSelect(i)}
          disabled={disabled}
          className={[
            'p-4 rounded-xl border-2 text-left transition-colors font-medium',
            selected === i
              ? 'border-blue-500 bg-blue-50 text-blue-900'
              : 'border-gray-200 bg-white hover:border-gray-400',
            disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          ].join(' ')}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
