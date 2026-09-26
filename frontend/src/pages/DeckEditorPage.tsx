import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addQuestions,
  deleteDeck,
  deleteQuestion,
  fetchDeckQuestions,
  updateDeck,
  updateQuestion,
  type QuestionInput,
} from '../api/deckEditorApi'
import { useAuth } from '../auth/AuthContext'
import { AiGeneratePanel } from '../components/deckEditor/AiGeneratePanel'
import { QuestionForm } from '../components/deckEditor/QuestionForm'
import { QuestionPreview } from '../components/deckEditor/QuestionPreview'
import { useDeck } from '../hooks/useDecks'
import type { Deck } from '../types/deck'
import type { Exercise } from '../types/exercise'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

/** `null` = no form open; 'new' = adding; otherwise the id of the question being edited. */
type EditingState = null | 'new' | string

export function DeckEditorPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { deck: loadedDeck, loading: deckLoading, error: deckError } = useDeck(slug ?? '')
  const [deck, setDeck] = useState<Deck | null>(null)
  const [questions, setQuestions] = useState<Exercise[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingState>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isOwner = Boolean(loadedDeck && user && loadedDeck.ownerId === String(user.id))

  useEffect(() => {
    if (!loadedDeck || !isOwner) return
    let cancelled = false
    fetchDeckQuestions(loadedDeck.id)
      .then((result) => {
        if (cancelled) return
        setDeck(result.deck)
        setTitle(result.deck.title)
        setDescription(result.deck.description)
        setQuestions(result.questions)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load questions.')
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadedDeck, isOwner])

  if (deckLoading) return <p className="text-sm text-slate-400">Loading deck…</p>
  if (deckError) return <p className="text-sm text-red-600">{deckError}</p>
  if (!loadedDeck || !isOwner) {
    return (
      <section className="space-y-2">
        <p className="text-sm text-slate-500">You can only edit decks you created.</p>
        <Link to="/" className="text-sm font-semibold text-blue-700">
          ← All decks
        </Link>
      </section>
    )
  }

  const deckId = loadedDeck.id
  const currentSlug = deck?.slug ?? loadedDeck.slug

  const saveDetails = async (event: React.FormEvent) => {
    event.preventDefault()
    setDetailsMessage(null)
    try {
      const updated = await updateDeck(deckId, { title, description })
      setDeck(updated)
      setDetailsMessage('Saved.')
    } catch (err) {
      setDetailsMessage(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  const saveQuestion = async (question: QuestionInput) => {
    setSaving(true)
    setFormError(null)
    try {
      if (editing === 'new') {
        const { questions: created } = await addQuestions(deckId, [question])
        setQuestions((prev) => [...prev, ...created])
      } else if (editing) {
        const updated = await updateQuestion(deckId, editing, question)
        setQuestions((prev) => prev.map((q) => (q.id === editing ? updated : q)))
      }
      setEditing(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the question.')
    } finally {
      setSaving(false)
    }
  }

  const removeQuestion = async (exercise: Exercise) => {
    if (!window.confirm('Delete this question? Its answer history stays in your stats.')) return
    try {
      await deleteQuestion(deckId, exercise.id)
      setQuestions((prev) => prev.filter((q) => q.id !== exercise.id))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete the question.')
    }
  }

  const addGenerated = async (generated: QuestionInput[]) => {
    const { questions: created } = await addQuestions(deckId, generated)
    setQuestions((prev) => [...prev, ...created])
  }

  const removeDeck = async () => {
    if (!window.confirm(`Delete "${deck?.title ?? loadedDeck.title}" and all ${questions.length} questions? This cannot be undone.`)) return
    try {
      await deleteDeck(deckId)
      navigate('/', { replace: true })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete the deck.')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/deck/${currentSlug}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          ← Back to deck
        </Link>
        {questions.length > 0 && (
          <Link
            to={`/deck/${currentSlug}/study`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Study this deck
          </Link>
        )}
      </div>

      <form onSubmit={saveDetails} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" aria-label="Deck details">
        <h2 className="text-xl font-semibold text-slate-900">Edit deck</h2>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Title</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Description</span>
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
            Save details
          </button>
          {detailsMessage && <span className="text-sm text-slate-500">{detailsMessage}</span>}
        </div>
      </form>

      <AiGeneratePanel deckId={deckId} onAdd={addGenerated} />

      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" aria-label="Questions">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Questions ({questions.length})</h3>
          {editing === null && (
            <button
              type="button"
              onClick={() => {
                setFormError(null)
                setEditing('new')
              }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Add question
            </button>
          )}
        </div>

        {editing === 'new' && (
          <QuestionForm saving={saving} serverError={formError} onSave={saveQuestion} onCancel={() => setEditing(null)} />
        )}

        {questionsLoading && <p className="text-sm text-slate-400">Loading questions…</p>}
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {!questionsLoading && !loadError && questions.length === 0 && editing !== 'new' && (
          <p className="text-sm text-slate-500">No questions yet. Add one by hand or generate a batch with AI above.</p>
        )}

        <ul className="space-y-2">
          {questions.map((exercise) =>
            editing === exercise.id ? (
              <li key={exercise.id}>
                <QuestionForm
                  initial={exercise}
                  saving={saving}
                  serverError={formError}
                  onSave={saveQuestion}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={exercise.id} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <QuestionPreview question={exercise} />
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    disabled={editing !== null}
                    onClick={() => {
                      setFormError(null)
                      setEditing(exercise.id)
                    }}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(exercise)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      </section>

      <button type="button" onClick={removeDeck} className="text-sm font-semibold text-red-600 hover:text-red-700">
        Delete this deck
      </button>
    </section>
  )
}
