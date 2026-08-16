import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { QuestionCountPicker } from '../components/QuestionCountPicker'
import { QuizSession } from '../components/QuizSession'
import { useDeck } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { useStats } from '../hooks/useProgress'
import { shuffle } from '../lib/shuffle'
import { selectUntriedExercises } from '../lib/untriedExercises'

interface StudySessionNavState {
  topics?: string[]
}

export function StudySessionPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { deck, loading: deckLoading, error: deckError } = useDeck(slug ?? '')
  const { exercises, loading: exercisesLoading, error: exercisesError } = useDeckExercises(deck?.id ?? '')
  const { stats } = useStats(deck?.id)
  // Optional topic filter passed by DeckDetailPage's topic chips. Absent when the study route is
  // reached directly (e.g. a bookmark or refresh), in which case every deck exercise is in play.
  const selectedTopics = (location.state as StudySessionNavState | null)?.topics
  const topicFilteredExercises = useMemo(
    () => (selectedTopics && selectedTopics.length > 0 ? exercises.filter((e) => selectedTopics.includes(e.topic)) : exercises),
    [exercises, selectedTopics]
  )
  // Shuffled once per fetch (not on every render, which would reorder questions out from under
  // the user mid-session) — `topicFilteredExercises` is a stable array reference until a
  // genuinely new fetch or topic selection replaces it, so this only recomputes when that happens.
  const shuffledExercises = useMemo(() => shuffle(topicFilteredExercises), [topicFilteredExercises])
  // Generated once via a lazy useState initializer rather than inline Date.now() in the
  // QuizSession prop below — calling Date.now() directly during render is an impure call React
  // flags, but a lazy useState initializer is the sanctioned one-time-at-mount escape hatch.
  // Keyed on `slug` (available immediately from the route) rather than `deck.id` (only
  // available after the deck fetch resolves) so it doesn't need to wait for that to happen.
  const [sessionId] = useState(() => `deck-${slug}-${Date.now()}`)
  // null = the picker hasn't been confirmed yet; once set, the count is fixed for the session
  // (not recomputed if the user could somehow trigger a reshuffle mid-session).
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const [untriedOnly, setUntriedOnly] = useState(false)

  const statsByExerciseId = useMemo(() => new Map(stats.map((s) => [s.exercise_id, s])), [stats])
  const untriedExercises = useMemo(
    () => selectUntriedExercises(shuffledExercises, statsByExerciseId),
    [shuffledExercises, statsByExerciseId]
  )
  const availableExercises = untriedOnly ? untriedExercises : shuffledExercises

  const loading = deckLoading || (Boolean(deck) && exercisesLoading)
  const error = deckError ?? exercisesError
  const sessionExercises = useMemo(
    () => (questionCount === null ? [] : availableExercises.slice(0, questionCount)),
    [availableExercises, questionCount]
  )

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

      {!loading && !error && deck && questionCount === null && (
        <QuestionCountPicker
          totalAvailable={availableExercises.length}
          onConfirm={(count) => setQuestionCount(count)}
          untriedOnly={untriedOnly}
          onUntriedOnlyChange={setUntriedOnly}
          untriedCount={untriedExercises.length}
        />
      )}

      {!loading && !error && deck && questionCount !== null && (
        <QuizSession
          exercises={sessionExercises}
          sessionId={sessionId}
          sessionMode="practice"
          onExit={() => navigate(`/deck/${deck.slug}`)}
        />
      )}
    </section>
  )
}
