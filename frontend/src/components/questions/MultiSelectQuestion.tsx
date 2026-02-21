import { useState } from 'react'
import type { QuestionComponentProps } from './questionRegistry'
import type { MultiSelectExercise } from '../../types/exercise'

export function MultiSelectQuestion({
  exercise,
  onAnswer,
  disabled,
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
            selected.has(i)
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
          <span className="font-medium">{option}</span>
        </label>
      ))}
    </div>
  )
}
