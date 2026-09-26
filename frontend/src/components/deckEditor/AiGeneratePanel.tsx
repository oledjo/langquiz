import { useState } from 'react'
import { generateQuestions, type QuestionInput } from '../../api/deckEditorApi'
import { QuestionPreview } from './QuestionPreview'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100'

interface Props {
  deckId: string
  /** Saves the chosen draft questions; resolves when they are in the deck. */
  onAdd: (questions: QuestionInput[]) => Promise<void>
}

/**
 * Topic or pasted text → Claude drafts questions → the user ticks the ones to keep → saved.
 * Nothing reaches the deck until "Add selected".
 */
export function AiGeneratePanel({ deckId, onAdd }: Props) {
  const [topic, setTopic] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [count, setCount] = useState(10)
  const [language, setLanguage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<QuestionInput[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dropped, setDropped] = useState(0)

  const generate = async () => {
    setError(null)
    setGenerating(true)
    try {
      const result = await generateQuestions(deckId, {
        topic: topic.trim() || undefined,
        sourceText: sourceText.trim() || undefined,
        count,
        language: language.trim() || undefined,
      })
      setDraft(result.questions)
      setSelected(new Set(result.questions.map((_, i) => i)))
      setDropped(result.dropped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const toggle = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  const addSelected = async () => {
    setError(null)
    setAdding(true)
    try {
      await onAdd(draft.filter((_, i) => selected.has(i)))
      setDraft([])
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the questions.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm" aria-label="Generate with AI">
      <div>
        <h3 className="text-base font-semibold text-slate-900">✨ Generate with AI</h3>
        <p className="text-sm text-slate-500">Describe a topic or paste your notes. You review the draft before anything is added.</p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Topic</span>
        <input
          className={inputClass}
          placeholder="e.g. Photosynthesis for 8th grade, Spanish irregular verbs, AWS S3 basics"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={300}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Or paste text to quiz on (optional)</span>
        <textarea className={inputClass} rows={4} value={sourceText} onChange={(e) => setSourceText(e.target.value)} maxLength={20000} />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold text-slate-600">Questions</span>
          <input
            type="number"
            min={1}
            max={20}
            className={`${inputClass} w-24`}
            value={count}
            onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold text-slate-600">Language (optional)</span>
          <input className={`${inputClass} w-40`} placeholder="e.g. English" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={generating || (!topic.trim() && !sourceText.trim())}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {generating ? 'Generating… (up to a minute)' : draft.length ? 'Generate again' : 'Generate'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {draft.length > 0 && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {draft.length} drafted{dropped > 0 ? `, ${dropped} discarded as invalid` : ''}. Untick the ones you don't want.
            </p>
            <button
              type="button"
              onClick={addSelected}
              disabled={adding || selected.size === 0}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {adding ? 'Adding…' : `Add selected (${selected.size})`}
            </button>
          </div>
          <ul className="space-y-2">
            {draft.map((question, index) => (
              <li key={index} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-violet-600"
                  aria-label={`Keep draft question ${index + 1}`}
                  checked={selected.has(index)}
                  onChange={() => toggle(index)}
                />
                <QuestionPreview question={question} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
