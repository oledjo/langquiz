import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuizSession } from '../components/QuizSession'
import { useDeck } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { shuffle } from '../lib/shuffle'

export function StudySessionPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { deck, loading: deckLoading, error: deckError } = useDeck(slug ?? '')
  const { exercises, loading: exercisesLoading, error: exercisesError } = useDeckExercises(deck?.id ?? '')
  // Shuffled once per fetch (not on every render, which would reorder questions out from under
  // the user mid-session) — `exercises` is a stable array reference from useDeckExercises until
  // a genuinely new fetch replaces it, so this only recomputes when that happens.
  const shuffledExercises = useMemo(() => shuffle(exercises), [exercises])
  // Generated once via a lazy useState initializer rather than inline Date.now() in the
  // QuizSession prop below — calling Date.now() directly during render is an impure call React
  // flags, but a lazy useState initializer is the sanctioned one-time-at-mount escape hatch.
  // Keyed on `slug` (available immediately from the route) rather than `deck.id` (only
  // available after the deck fetch resolves) so it doesn't need to wait for that to happen.
  const [sessionId] = useState(() => `deck-${slug}-${Date.now()}`)

  const loading = deckLoading || (Boolean(deck) && exercisesLoading)
  const error = deckError ?? exercisesError

  return (
    <section className="space-y-4">
      {deck && (
        <Link to={`/deck/${deck.slug}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          ← {deck.title}
        </Link>
      )}

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!deckLoading && !deckError && !deck && <p className="text-sm text-slate-500">Deck not found.</p>}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && deck && (
        <QuizSession
          exercises={shuffledExercises}
          sessionId={sessionId}
          sessionMode="practice"
          onExit={() => navigate(`/deck/${deck.slug}`)}
        />
      )}
    </section>
  )
}
