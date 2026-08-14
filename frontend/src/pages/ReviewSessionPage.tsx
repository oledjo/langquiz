import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QuizSession } from '../components/QuizSession'
import { useExercises } from '../hooks/useExercises'
import { useStats } from '../hooks/useProgress'
import { selectDueExercises } from '../lib/dueReviews'

export function ReviewSessionPage() {
  const navigate = useNavigate()
  const { exercises, isLoading: exercisesLoading } = useExercises()
  const { stats, loading: statsLoading } = useStats()
  const [nowMs] = useState(() => Date.now())
  const [sessionId] = useState(() => `review-${Date.now()}`)

  const statsByExerciseId = useMemo(() => new Map(stats.map((s) => [s.exercise_id, s])), [stats])
  const dueExercises = useMemo(
    () => selectDueExercises(exercises, statsByExerciseId, nowMs),
    [exercises, statsByExerciseId, nowMs]
  )

  const loading = exercisesLoading || statsLoading

  return (
    <section className="space-y-4">
      <Link to="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← Home
      </Link>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && dueExercises.length === 0 && (
        <p className="text-sm text-slate-500">No reviews are due right now. Check back later.</p>
      )}

      {!loading && dueExercises.length > 0 && (
        <QuizSession
          exercises={dueExercises}
          sessionId={sessionId}
          sessionMode="due-review"
          onExit={() => navigate('/')}
        />
      )}
    </section>
  )
}
