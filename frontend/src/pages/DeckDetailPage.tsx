import { Link, useParams } from 'react-router-dom'
import { useDeck } from '../hooks/useDecks'

export function DeckDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { deck, loading, error } = useDeck(slug ?? '')

  return (
    <section className="space-y-4">
      <Link to="/library" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← Library
      </Link>

      {loading && <p className="text-sm text-slate-400">Loading deck…</p>}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && !deck && (
        <p className="text-sm text-slate-500">Deck not found.</p>
      )}

      {!loading && !error && deck && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{deck.origin}</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{deck.title}</h2>
          {deck.description && <p className="mt-2 text-sm text-slate-600">{deck.description}</p>}

          {deck.facetDefinitions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {deck.facetDefinitions.map((facet) => (
                <span
                  key={facet.key}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  {facet.label}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Modes: {deck.studyModes.join(', ')} · Languages: {deck.locales.join(', ') || '—'}
          </p>
        </div>
      )}
    </section>
  )
}
