import { useState } from 'react'
import type { QuestionComponentProps } from './questionRegistry'
import type { SelectionExercise } from '../../types/exercise'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// Media URLs from the backend are absolute paths (e.g. /static/images/einburgertest/foo.svg);
// resolve them against the API origin so this works whether the frontend is served from the
// same host as the API (local dev) or a different one (production).
function resolveMediaUrl(url: string | null): string | undefined {
  if (!url) return undefined
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

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
  const optionImages = exercise.optionImages

  return (
    <div className={optionImages ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
      {exercise.options.map((option, i) => {
        const isCorrectOption = i === exercise.answer
        const isSelected = selected === i
        const candidate = optionImages?.[i]
        // A slot with neither a picture nor a description is a placeholder for an option that has
        // no artwork of its own — render it as a plain text option.
        const image = candidate && (candidate.url || candidate.alt.trim()) ? candidate : undefined

        return (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={disabled}
            className={[
              'rounded-xl border-2 text-left transition-colors font-medium',
              image ? 'p-3 space-y-2' : 'p-4',
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
            {!image ? (
              option
            ) : image.url ? (
              <>
                <img
                  src={resolveMediaUrl(image.url)}
                  alt={image.alt}
                  className="w-full h-32 object-contain rounded-lg bg-white"
                />
                <span className="block text-center">{option}</span>
              </>
            ) : (
              // This option's picture has not been sourced yet, so the learner picks from its
              // official description instead — the label alone ("Bild 3") says nothing.
              <>
                <span className="block">{option}</span>
                <span className="block text-sm font-normal leading-relaxed text-slate-600">{image.alt}</span>
              </>
            )}
            {showValidation && isCorrectOption && !isSelected && (
              <span className="ml-2 text-xs font-semibold text-emerald-700">Correct answer</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
