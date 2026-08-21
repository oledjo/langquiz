import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useDecks } from '../hooks/useDecks'
import { useExercises } from '../hooks/useExercises'
import { useReviewMetrics, useStats } from '../hooks/useProgress'
import { selectDueExercises } from '../lib/dueReviews'
import { ImportExercisesModal } from '../components/ImportExercisesModal'
import type { Deck } from '../types/deck'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

function DeckCard({ deck }: { deck: Deck }) {
  const { metrics } = useReviewMetrics(deck.id)
  const dueCount = metrics?.totals.due_now ?? 0

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/deck/${deck.slug}`} className="block">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{deck.origin}</p>
        <h3 className="mt-1 truncate text-lg font-semibold text-slate-800">{deck.title}</h3>
        {deck.description && <p className="mt-1 truncate text-sm text-slate-500">{deck.description}</p>}
      </Link>
      {dueCount > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            {dueCount} due
          </span>
          <Link
            to={`/deck/${deck.slug}/review`}
            className={[
              'rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700',
              focusRingClass,
            ].join(' ')}
          >
            Review due
          </Link>
        </div>
      )}
    </div>
  )
}

export function HomePage() {
  const { isGuest } = useAuth()
  const { decks, loading: decksLoading, error: decksError } = useDecks()
  const { exercises } = useExercises()
  const { stats } = useStats()
  const [nowMs] = useState(() => Date.now())

  const statsByExerciseId = useMemo(() => new Map(stats.map((s) => [s.exercise_id, s])), [stats])
  const dueExercises = useMemo(
    () => selectDueExercises(exercises, statsByExerciseId, nowMs),
    [exercises, statsByExerciseId, nowMs]
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Pick a deck to practice</h2>
          <p className="mt-1 text-sm text-slate-500">Browse decks, then choose practice or exam mode.</p>
        </div>
        {!isGuest && <ImportExercisesModal knownExercises={exercises} />}
      </div>

      {!isGuest && dueExercises.length > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Due reviews</h3>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {dueExercises.length} due
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">Spaced-repetition reviews are ready across your decks.</p>
            </div>
            <Link
              to="/review"
              className={[
                'block w-full rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-700 sm:inline-block sm:w-auto',
                focusRingClass,
              ].join(' ')}
            >
              Review due now
            </Link>
          </div>
        </div>
      )}

      {decksLoading && <p className="text-sm text-slate-400">Loading decks…</p>}

      {!decksLoading && decksError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{decksError}</div>
      )}

      {!decksLoading && !decksError && decks.length === 0 && (
        <p className="text-sm text-slate-500">No decks available yet.</p>
      )}

      {!decksLoading && !decksError && decks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}

      {isGuest && (
        <p className="text-xs text-slate-500">Guest mode covers the official decks and does not save progress.</p>
      )}
    </section>
  )
}
