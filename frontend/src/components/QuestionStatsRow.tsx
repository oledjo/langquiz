import { accuracyPercent, type QuestionStats } from '../lib/questionStats'

interface Props {
  stats: QuestionStats
}

/** All-time right/wrong counts for a question and its recent answers (newest on the right). */
export function QuestionStatsRow({ stats }: Props) {
  const pct = accuracyPercent(stats)
  const recentText = stats.recent.map((ok) => (ok ? 'right' : 'wrong')).join(', ')

  return (
    <div
      data-testid="question-stats"
      aria-label={`Answered right ${stats.correct} times, wrong ${stats.incorrect} times. Recent: ${recentText}.`}
      className="space-y-1.5 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-slate-700"
    >
      <div className="flex items-center gap-3 text-sm font-semibold">
        <span className="text-green-700">✓ {stats.correct}</span>
        <span className="text-red-600">✗ {stats.incorrect}</span>
        {pct !== null && <span className="text-slate-500">{pct}%</span>}
      </div>
      {stats.recent.length > 0 && (
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="mr-1 text-xs text-slate-500">Recent</span>
          {stats.recent.map((ok, index) => (
            <span
              key={index}
              className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
