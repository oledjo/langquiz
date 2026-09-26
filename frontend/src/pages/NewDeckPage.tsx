import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createDeck } from '../api/deckEditorApi'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

export function NewDeckPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const deck = await createDeck({ title: title.trim(), description: description.trim() })
      navigate(`/deck/${deck.slug}/edit`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the deck.')
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <Link to="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← All decks
      </Link>
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" aria-label="New deck">
        <h2 className="text-xl font-semibold text-slate-900">New deck</h2>
        <p className="text-sm text-slate-500">Private to you. Add questions by hand or generate them with AI on the next screen.</p>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Title</span>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Cell biology, Spanish verbs, Kubernetes basics"
            required
            autoFocus
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Description (optional)</span>
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create deck'}
        </button>
      </form>
    </section>
  )
}
