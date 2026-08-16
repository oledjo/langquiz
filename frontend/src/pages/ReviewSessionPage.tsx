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
  const dueExercises = useMemo(
    () => selectDueExercises(exercises, statsByExerciseId, nowMs),
    [exercises, statsByExerciseId, nowMs]
  )

  return (
    <section className="space-y-4">
      <Link to={backLink.to} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← {backLink.label}
      </Link>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && dueExercises.length === 0 && (
        <p className="text-sm text-slate-500">No reviews are due right now. Check back later.</p>
      )}

      {!loading && dueExercises.length > 0 && (
        <QuizSession exercises={dueExercises} sessionId={sessionId} sessionMode="due-review" onExit={onExit} />
      )}
    </section>
  )
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
