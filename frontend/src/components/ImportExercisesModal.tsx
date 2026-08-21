import { useEffect, useState } from 'react'
import { useUserExercises } from '../hooks/useUserExercises'
import type { Exercise } from '../types/exercise'
import { trackEvent } from '../analytics/client'
import { useAuth } from '../auth/AuthContext'
import { formatTopicLabel } from '../lib/topicInsights'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

const LLM_EXERCISE_PROMPT_SAMPLE = `Generate 12 German learning exercises as strict JSON for Repzy.

Return ONLY valid JSON, no markdown and no explanation.
Use this exact structure:
{
  "exercises": [
    {
      "type": "selection",
      "topic": "adjective declension",
      "subtopic": "weak-declension",
      "language": "de",
      "group": "grammar",
      "level": "A2",
      "difficulty": 3,
      "prompt": "Choose the correct adjective ending.",
      "context": "Der alt___ Mann schläft.",
      "grammarNote": "With definite article 'der' in nominative masculine, adjective ending is -e.",
      "options": ["-e", "-en", "-er", "-es"],
      "answer": 0,
      "explanation": "After definite article der, nominative masculine takes -e.",
      "tags": ["adjectives", "weak-declension", "nominative", "masculine"]
    }
  ]
}

Allowed "type" values:
- "selection" requires "options" (string[]) and "answer" (number)
- "free-type" requires "answers" (string[]) and optional "caseSensitive" (boolean)
- "multiselect" requires "options" (string[]) and "answers" (number[])

Rules:
- difficulty must be integer 1..5
- group must be "grammar" or "vocabulary"
- level must be one of: A1, A2, B1, B2, C1, C2
- Keep language = "de"
- Include explanation for each item
- Optional: add "grammarNote" (short grammar cheat sheet shown via a button on the question card)
- Ensure answer indexes are valid for options
- Mix types: 5 selection, 4 free-type, 3 multiselect
- Do NOT include "id" field (Repzy auto-generates IDs on import)`

function formatTimestamp(date: Date | null): string {
  if (!date) return 'No recent import'
  return `Updated ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

interface ImportExercisesModalProps {
  /** Question banks the caller has already loaded, used to reject duplicate imports. */
  knownExercises?: Exercise[]
}

export function ImportExercisesModal({ knownExercises = [] }: ImportExercisesModalProps) {
  const { user } = useAuth()
  const { userExercises, importExercises, deleteByTopic, clearAll, shareAllForApproval, topicCounts } =
    useUserExercises()

  const [isOpen, setIsOpen] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const setStatus = (message: string) => {
    setStatusMessage(message)
    setUpdatedAt(new Date())
  }

  const handleFileSelect = async (file: File | null) => {
    if (!file) return
    setJsonInput(await file.text())
  }

  const handleImport = async () => {
    const result = await importExercises(jsonInput, knownExercises)
    if (result.added === 0 && result.errors.length === 0) {
      setStatus('No exercises were added.')
      return
    }
    const firstErrors = result.errors.slice(0, 2).join(' ')
    const suffix = result.errors.length > 2 ? ` (+${result.errors.length - 2} more errors)` : ''
    setStatus(`Imported ${result.added}, skipped ${result.skipped}.${firstErrors ? ` ${firstErrors}${suffix}` : ''}`)
    void trackEvent('import_used', {
      user_id: user?.id,
      properties: { added: result.added, skipped: result.skipped, errors: result.errors.length },
    })
  }

  const handleClear = async () => {
    await clearAll()
    setStatus('Custom exercises removed.')
  }

  const handleShare = async () => {
    const requested = await shareAllForApproval()
    setStatus(requested === 0 ? 'No private/rejected custom exercises to share.' : `Sent ${requested} custom exercise(s) for admin approval.`)
  }

  const handleDeleteTopic = async (topic: string) => {
    const removed = await deleteByTopic(topic)
    setStatus(removed === 0 ? `No imported exercises found for "${topic}".` : `Removed ${removed} imported exercise(s) from "${topic}".`)
  }

  const copyPromptSample = async () => {
    try {
      await navigator.clipboard.writeText(LLM_EXERCISE_PROMPT_SAMPLE)
      setStatus('Prompt sample copied to clipboard.')
    } catch {
      setStatus('Could not copy prompt sample. Copy it manually from the modal.')
    }
  }

  const topics = Object.entries(topicCounts)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={[
          'rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50',
          focusRingClass,
        ].join(' ')}
      >
        Import your own exercises{userExercises.length > 0 ? ` (${userExercises.length})` : ''}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Import custom exercises"
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-800">Load your own exercises</h3>
              <button
                onClick={() => setIsOpen(false)}
                className={[
                  'rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200',
                  focusRingClass,
                ].join(' ')}
              >
                Close
              </button>
            </div>

            <p className="mb-3 text-sm text-slate-600">
              Paste JSON array (or {'{ "exercises": [...] }'}) using the app exercise schema.
            </p>

            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">LLM Prompt Sample</p>
                <button
                  onClick={copyPromptSample}
                  className={[
                    'rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900',
                    focusRingClass,
                  ].join(' ')}
                >
                  Copy prompt
                </button>
              </div>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                {LLM_EXERCISE_PROMPT_SAMPLE}
              </pre>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-600">
                Custom exercises loaded: <span className="font-semibold text-slate-800">{userExercises.length}</span>
              </p>
              <p className="text-xs text-slate-500">{formatTimestamp(updatedAt)}</p>
            </div>
            {statusMessage && (
              <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                {statusMessage}
              </p>
            )}

            {topics.length > 0 && (
              <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Your topics</p>
                <div className="flex flex-wrap gap-2">
                  {topics.map(([topic, count]) => (
                    <div
                      key={topic}
                      className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-800"
                    >
                      <span>
                        {formatTopicLabel(topic)} · {count}
                      </span>
                      <button
                        onClick={() => handleDeleteTopic(topic)}
                        className="font-semibold text-red-600 hover:text-red-700"
                        aria-label={`Delete imported exercises for ${topic}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={8}
              placeholder='[{"type":"selection","topic":"my-topic","subtopic":"basics","language":"de","group":"grammar","level":"A1","difficulty":2,"prompt":"...","options":["a","b"],"answer":0}]'
              className={[
                'mb-3 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none',
                focusRingClass,
              ].join(' ')}
            />

            <div className="flex flex-wrap gap-2">
              <label
                className={[
                  'cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50',
                  focusRingClass,
                ].join(' ')}
              >
                Upload JSON file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
              </label>

              <button
                onClick={handleImport}
                disabled={!jsonInput.trim()}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold',
                  focusRingClass,
                  jsonInput.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-slate-300 text-slate-600',
                ].join(' ')}
              >
                Import exercises
              </button>

              <button
                onClick={handleClear}
                disabled={userExercises.length === 0}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold',
                  focusRingClass,
                  userExercises.length > 0 ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'cursor-not-allowed bg-slate-100 text-slate-400',
                ].join(' ')}
              >
                Clear custom
              </button>

              <button
                onClick={handleShare}
                disabled={userExercises.length === 0}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold',
                  focusRingClass,
                  userExercises.length > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-300 text-slate-600',
                ].join(' ')}
              >
                Share imported for approval
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
