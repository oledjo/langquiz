import { useState } from 'react'
import type { QuestionComponentProps } from './questionRegistry'
import type { FreeTypeExercise } from '../../types/exercise'

export function FreeTypeQuestion({
  exercise,
  onAnswer,
  disabled,
}: QuestionComponentProps<FreeTypeExercise>) {
  const [value, setValue] = useState('')

  const handleChange = (text: string) => {
    setValue(text)
    onAnswer({ type: 'free-type', text })
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder="Type your answer..."
        autoComplete="off"
        spellCheck={false}
        className={[
          'w-full p-4 rounded-xl border-2 text-lg outline-none transition-colors',
          disabled
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
            : 'border-gray-300 focus:border-blue-500 bg-white',
        ].join(' ')}
      />
      {exercise.hint && !disabled && (
        <p className="text-sm text-amber-600">Hint: {exercise.hint}</p>
      )}
    </div>
  )
}
