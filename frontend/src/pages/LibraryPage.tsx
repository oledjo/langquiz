import { Link } from 'react-router-dom'
import { useDecks } from '../hooks/useDecks'

export function LibraryPage() {
  const { decks, loading, error } = useDecks()

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Library</h2>
        <p className="mt-1 text-sm text-slate-500">Browse decks and pick one to study.</p>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading decks…</p>}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && decks.length === 0 && (
        <p className="text-sm text-slate-500">No decks available yet.</p>
      )}

      {!loading && !error && decks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              to={`/deck/${deck.slug}`}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{deck.origin}</p>
              <h3 className="mt-1 truncate text-lg font-semibold text-slate-800">{deck.title}</h3>
              {deck.description && <p className="mt-1 truncate text-sm text-slate-500">{deck.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
