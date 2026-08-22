import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuizSession } from '../components/QuizSession'
import { useDeck } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { useExercises } from '../hooks/useExercises'
import { useStats } from '../hooks/useProgress'
import { selectDueExercises } from '../lib/dueReviews'
import type { ExerciseStats } from '../api/progressApi'
import type { Exercise } from '../types/exercise'

interface ReviewSessionBodyProps {
  backLink: { to: string; label: string }
  exercises: Exercise[]
  statsByExerciseId: Map<string, ExerciseStats>
  loading: boolean
  nowMs: number
  sessionId: string
  onExit: () => void
}

function ReviewSessionBody({
  backLink,
  exercises,
  statsByExerciseId,
  loading,
  nowMs,
  sessionId,
  onExit,
}: ReviewSessionBodyProps) {
  return (
    <section className="space-y-4">
      <Link to={backLink.to} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← {backLink.label}
      </Link>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && (
        <DueReviewSession
          exercises={exercises}
          statsByExerciseId={statsByExerciseId}
          nowMs={nowMs}
          sessionId={sessionId}
          onExit={onExit}
        />
      )}
    </section>
  )
}

/**
 * Mounted only once its inputs have loaded, so the due list can be picked in a lazy `useState`
 * initializer and then stay fixed for the session. It must not be recomputed while the session
 * runs: answering a question re-fetches the stats and pushes that question's due date into the
 * future, so a live `selectDueExercises` would drop every question already answered — shifting
 * the question on screen out from under the user, and on the last answer emptying the list and
 * replacing the results screen with "No reviews are due right now".
 */
function DueReviewSession({
  exercises,
  statsByExerciseId,
  nowMs,
  sessionId,
  onExit,
}: Omit<ReviewSessionBodyProps, 'backLink' | 'loading'>) {
  const [dueExercises] = useState(() => selectDueExercises(exercises, statsByExerciseId, nowMs))

  if (dueExercises.length === 0) {
    return <p className="text-sm text-slate-500">No reviews are due right now. Check back later.</p>
  }

  return <QuizSession exercises={dueExercises} sessionId={sessionId} sessionMode="due-review" onExit={onExit} />
}

function AllDecksReviewSession() {
  const navigate = useNavigate()
  const { exercises, isLoading: exercisesLoading } = useExercises()
  const { stats, loading: statsLoading } = useStats()
  const [nowMs] = useState(() => Date.now())
  const [sessionId] = useState(() => `review-${Date.now()}`)

  const statsByExerciseId = useMemo(() => new Map(stats.map((s) => [s.exercise_id, s])), [stats])

  return (
    <ReviewSessionBody
      backLink={{ to: '/', label: 'Home' }}
      exercises={exercises}
      statsByExerciseId={statsByExerciseId}
      loading={exercisesLoading || statsLoading}
      nowMs={nowMs}
      sessionId={sessionId}
      onExit={() => navigate('/')}
    />
  )
}

function DeckReviewSession({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const { deck, loading: deckLoading, error: deckError } = useDeck(slug)
  const { exercises, loading: exercisesLoading } = useDeckExercises(deck?.id ?? '')
  const { stats, loading: statsLoading } = useStats(deck?.id)
  const [nowMs] = useState(() => Date.now())
  const [sessionId] = useState(() => `review-${slug}-${Date.now()}`)

  const statsByExerciseId = useMemo(() => new Map(stats.map((s) => [s.exercise_id, s])), [stats])

  if (!deckLoading && !deckError && !deck) {
    return (
      <section className="space-y-4">
        <Link to="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          ← Home
        </Link>
        <p className="text-sm text-slate-500">Deck not found.</p>
      </section>
    )
  }

  return (
    <ReviewSessionBody
      backLink={{ to: deck ? `/deck/${deck.slug}` : '/', label: deck ? deck.title : 'Home' }}
      exercises={exercises}
      statsByExerciseId={statsByExerciseId}
      loading={deckLoading || exercisesLoading || statsLoading}
      nowMs={nowMs}
      sessionId={sessionId}
      onExit={() => navigate(deck ? `/deck/${deck.slug}` : '/')}
    />
  )
}

export function ReviewSessionPage() {
  const { slug } = useParams<{ slug?: string }>()
  if (slug) return <DeckReviewSession slug={slug} />
  return <AllDecksReviewSession />
}
