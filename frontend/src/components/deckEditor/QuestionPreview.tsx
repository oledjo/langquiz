import type { QuestionInput } from '../../api/deckEditorApi'

const TYPE_BADGES = { selection: 'One answer', multiselect: 'Several answers', 'free-type': 'Typed' } as const

/** Compact read-only view of a question: prompt, options with correct ones marked, explanation. */
export function QuestionPreview({ question }: { question: QuestionInput }) {
  const correct = new Set(
    question.type === 'selection' ? [question.answer] : question.type === 'multiselect' ? question.answers : []
  )
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
        {TYPE_BADGES[question.type]}
      </span>
      <p className="whitespace-pre-line text-sm font-medium text-slate-800">{question.prompt}</p>
      {question.type === 'free-type' ? (
        <p className="text-sm text-green-700">✓ {question.answers.join(' / ')}</p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {question.options.map((option, index) => (
            <li key={index} className={correct.has(index) ? 'font-medium text-green-700' : 'text-slate-500'}>
              {correct.has(index) ? '✓' : '·'} {option}
            </li>
          ))}
        </ul>
      )}
      {question.explanation && <p className="text-xs text-slate-500">{question.explanation}</p>}
    </div>
  )
}
