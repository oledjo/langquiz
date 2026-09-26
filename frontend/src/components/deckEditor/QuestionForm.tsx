import { useState } from 'react'
import type { QuestionInput } from '../../api/deckEditorApi'
import type { ExerciseType } from '../../types/exercise'
import { EMPTY_DRAFT, draftError, draftFromQuestion, questionFromDraft, type QuestionDraft } from './questionDraft'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const TYPE_LABELS: Record<ExerciseType, string> = {
  selection: 'One correct option',
  multiselect: 'Several correct options',
  'free-type': 'Typed answer',
}

interface Props {
  initial?: QuestionInput
  saving?: boolean
  serverError?: string | null
  onSave: (question: QuestionInput) => void
  onCancel: () => void
}

export function QuestionForm({ initial, saving = false, serverError, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<QuestionDraft>(() => (initial ? draftFromQuestion(initial) : EMPTY_DRAFT))
  const [touched, setTouched] = useState(false)
  const error = draftError(draft)

  const update = (patch: Partial<QuestionDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const setType = (type: ExerciseType) => {
    setDraft((d) => {
      if (type === 'free-type') return { ...d, type }
      const options = d.options.length >= 2 ? d.options : ['', '', '']
      const correct = type === 'selection' ? [d.correct[0] ?? 0] : d.correct.length ? d.correct : [0]
      return { ...d, type, options, correct }
    })
  }

  const toggleCorrect = (index: number) => {
    setDraft((d) => {
      if (d.type === 'selection') return { ...d, correct: [index] }
      const has = d.correct.includes(index)
      return { ...d, correct: has ? d.correct.filter((i) => i !== index) : [...d.correct, index] }
    })
  }

  const removeOption = (index: number) => {
    setDraft((d) => ({
      ...d,
      options: d.options.filter((_, i) => i !== index),
      correct: d.correct.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)),
    }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!error) onSave(questionFromDraft(draft))
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4" aria-label="Question editor">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Question type</legend>
        {(Object.keys(TYPE_LABELS) as ExerciseType[]).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={draft.type === type}
            onClick={() => setType(type)}
            className={[
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              draft.type === type ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </fieldset>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Question</span>
        <textarea className={inputClass} rows={2} value={draft.prompt} onChange={(e) => update({ prompt: e.target.value })} />
      </label>

      {draft.type === 'free-type' ? (
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Accepted answers (one per line)</span>
          <textarea className={inputClass} rows={3} value={draft.answersText} onChange={(e) => update({ answersText: e.target.value })} />
        </label>
      ) : (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-600">
            Options — mark {draft.type === 'selection' ? 'the correct one' : 'every correct one'}
          </span>
          {draft.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type={draft.type === 'selection' ? 'radio' : 'checkbox'}
                name="correct-option"
                aria-label={`Option ${index + 1} is correct`}
                checked={draft.correct.includes(index)}
                onChange={() => toggleCorrect(index)}
                className="h-4 w-4 accent-green-600"
              />
              <input
                className={inputClass}
                aria-label={`Option ${index + 1}`}
                value={option}
                onChange={(e) => update({ options: draft.options.map((o, i) => (i === index ? e.target.value : o)) })}
              />
              <button
                type="button"
                onClick={() => removeOption(index)}
                disabled={draft.options.length <= 2}
                aria-label={`Remove option ${index + 1}`}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
          {draft.options.length < 8 && (
            <button
              type="button"
              onClick={() => update({ options: [...draft.options, ''] })}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Explanation (optional, shown after answering)</span>
        <textarea className={inputClass} rows={2} value={draft.explanation} onChange={(e) => update({ explanation: e.target.value })} />
      </label>

      {((touched && error) || serverError) && (
        <p role="alert" className="text-sm text-red-600">
          {touched && error ? error : serverError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save question'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">
          Cancel
        </button>
      </div>
    </form>
  )
}
