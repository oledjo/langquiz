import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuizSession } from '../components/QuizSession'
import { useDeck } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { useStats } from '../hooks/useProgress'
import { useStudyToday } from '../hooks/useStudyToday'
import { selectNewExercises } from '../lib/newExercises'
import type { ExerciseStats } from '../api/progressApi'
import type { Deck } from '../types/deck'
import type { Exercise } from '../types/exercise'

/**
 * Picked once, when everything has loaded: answering a new question gives it stats, so a live
 * selection would drop each question as soon as it is answered (same reason as the review page).
 */
function NewCardsSession({
  deck,
  exercises,
  statsByExerciseId,
  limit,
  onExit,
}: {
  deck: Deck
  exercises: Exercise[]
  statsByExerciseId: Map<string, ExerciseStats>
  limit: number
  onExit: () => void
}) {
  const [newExercises] = useState(() => selectNewExercises(deck, exercises, statsByExerciseId, limit))
  const [sessionId] = useState(() => `new-${deck.slug}-${Date.now()}`)

  if (newExercises.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {limit <= 0
          ? "You've learned today's quota of new questions. Come back tomorrow, or raise the limit on the Progress page."
          : 'No new questions left in this deck.'}
      </p>
    )
  }

  return (
    <QuizSession
      exercises={newExercises}
      statsByExerciseId={statsByExerciseId}
      sessionId={sessionId}
      sessionMode="practice"
      onExit={onExit}
    />
  )
}

export function NewCardsSessionPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { deck, loading: deckLoading, error: deckError } = useDeck(slug ?? '')
  const { exercises, loading: exercisesLoading } = useDeckExercises(deck?.id ?? '')
  const { stats, loading: statsLoading } = useStats(deck?.id)
  const { today, loading: todayLoading } = useStudyToday()
  const statsByExerciseId = useMemo(() => new Map(stats.map((s) => [s.exercise_id, s])), [stats])

  const loading = deckLoading || (Boolean(deck) && (exercisesLoading || statsLoading)) || todayLoading

  return (
    <section className="space-y-4">
      <Link to={deck ? `/deck/${deck.slug}` : '/'} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← {deck ? deck.title : 'Home'}
      </Link>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {!loading && deckError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{deckError}</div>
      )}
      {!loading && !deckError && !deck && <p className="text-sm text-slate-500">Deck not found.</p>}

      {!loading && deck && (
        <NewCardsSession
          deck={deck}
          exercises={exercises}
          statsByExerciseId={statsByExerciseId}
          limit={today?.newRemaining ?? 20}
          onExit={() => navigate(`/deck/${deck.slug}`)}
        />
      )}
    </section>
  )
}
