import { useProgressSummary, useStats } from '../hooks/useProgress'
import type { Exercise } from '../types/exercise'

interface Props {
  exercises?: Exercise[]
}

export function ProgressDashboard({ exercises = [] }: Props) {
  const { stats, loading, error } = useStats()
  const { summary, loading: summaryLoading, error: summaryError } = useProgressSummary()
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading progress...</div>
  }

  if (error) {
    return (
      <div className="text-red-400 py-12 text-center">
        <p>Could not load progress.</p>
        <p className="text-sm mt-1">Check backend availability and CORS configuration.</p>
        <p className="text-xs mt-2 text-red-500/80">{error}</p>
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">By Period</h3>
        {summaryError && (
          <p className="text-sm text-red-500">
            Could not load period stats: {summaryError}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'day', label: 'Today', value: summary?.day },
            { key: 'week', label: 'Last 7 days', value: summary?.week },
            { key: 'month', label: 'Last 30 days', value: summary?.month },
          ].map((period) => {
            const total = period.value?.total ?? 0
            const correct = period.value?.correct ?? 0
            const pct = total > 0 ? Math.round((correct / total) * 100) : 0
            return (
              <div key={period.key} className="rounded-xl border border-gray-100 p-4">
                <p className="text-sm text-gray-400">{period.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{total}</p>
                <p className={`text-sm mt-1 ${pct >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
                  {correct}/{total} correct ({pct}%)
                </p>
              </div>
            )
          })}
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Daily activity (last 14 days)</p>
          {summaryLoading ? (
            <p className="text-sm text-gray-400">Loading chart...</p>
          ) : (
            <div className="h-48 rounded-xl border border-gray-100 p-3 flex items-end gap-1 bg-gray-50">
              {(() => {
                const bars = summary?.bars ?? []
                const maxTotal = Math.max(1, ...bars.map((b) => b.total))
                return bars.map((bar) => {
                  const height = Math.max(4, Math.round((bar.total / maxTotal) * 100))
                  return (
                    <div key={bar.day} className="flex-1 flex flex-col justify-end items-center gap-1">
                      <div
                        className="w-full bg-blue-500/85 rounded-t-sm"
                        style={{ height: `${height}%` }}
                        title={`${bar.day}: ${bar.correct}/${bar.total}`}
                      />
                      <span className="text-[10px] text-gray-400">
                        {bar.day.slice(5)}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          By Exercise
        </h3>
        <div className="divide-y rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          {stats.map((s) => {
            const exercise = byId.get(s.exercise_id)
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
                    {exercise
                      ? `${exercise.topic} / ${exercise.subtopic}${exercise.group ? ` · ${exercise.group}` : ''}${exercise.level ? ` · ${exercise.level}` : ''}`
                      : 'Unknown exercise'}
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
