import { useStats } from '../hooks/useProgress'
import { getExerciseById } from '../registry/exerciseRegistry'

export function ProgressDashboard() {
  const { stats, loading, error } = useStats()

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading progress...</div>
  }

  if (error) {
    return (
      <div className="text-red-400 py-12 text-center">
        <p>Could not load progress.</p>
        <p className="text-sm mt-1">Make sure the backend is running on port 3001.</p>
      </div>
    )
  }

  if (stats.length === 0) {
    return (
      <div className="text-gray-400 py-12 text-center">
        <p className="text-lg">No progress recorded yet.</p>
        <p className="text-sm mt-1">Complete some exercises to see your stats here.</p>
      </div>
    )
  }

  const overall = {
    total: stats.reduce((s, r) => s + r.total_attempts, 0),
    correct: stats.reduce((s, r) => s + r.correct_attempts, 0),
  }
  const overallPct = overall.total > 0 ? Math.round((overall.correct / overall.total) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex gap-8">
        <div>
          <p className="text-sm text-gray-400">Total answered</p>
          <p className="text-3xl font-bold text-gray-800">{overall.total}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Correct</p>
          <p className="text-3xl font-bold text-green-600">{overall.correct}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Accuracy</p>
          <p className={`text-3xl font-bold ${overallPct >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
            {overallPct}%
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          By Exercise
        </h3>
        <div className="divide-y rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          {stats.map((s) => {
            const exercise = getExerciseById(s.exercise_id)
            const pct =
              s.total_attempts > 0
                ? Math.round((s.correct_attempts / s.total_attempts) * 100)
                : 0
            return (
              <div key={s.exercise_id} className="flex items-center justify-between p-4 text-sm">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="font-medium text-gray-800 truncate">
                    {exercise?.prompt ?? s.exercise_id}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {exercise ? `${exercise.topic} / ${exercise.subtopic}` : 'Unknown exercise'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`font-semibold ${
                      pct >= 70 ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {pct}%
                  </p>
                  <p className="text-gray-400 text-xs">
                    {s.correct_attempts}/{s.total_attempts}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
