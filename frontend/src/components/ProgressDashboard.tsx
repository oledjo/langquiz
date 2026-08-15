import { useEffect, useMemo, useState } from 'react'
import { useReviewMetrics, useStats } from '../hooks/useProgress'
import type { Exercise } from '../types/exercise'
import { DeckCompositionPieChart, type CompositionSlice } from './DeckCompositionPieChart'

interface Props {
  exercises?: Exercise[]
  deckId?: string
}

const PAGE_SIZE = 12

interface TopicSummary {
  topic: string
  total: number
  correct: number
  accuracyPct: number
  dueNow: number
}

export function ProgressDashboard({ exercises = [], deckId }: Props) {
  const { stats, loading, error } = useStats(deckId)
  const { metrics: reviewMetrics, loading: reviewMetricsLoading, error: reviewMetricsError } = useReviewMetrics(deckId)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [tableQuery, setTableQuery] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60 * 1000)
    return () => window.clearInterval(id)
  }, [])


  const overall = useMemo(
    () => ({
      total: stats.reduce((sum, row) => sum + row.total_attempts, 0),
      correct: stats.reduce((sum, row) => sum + row.correct_attempts, 0),
    }),
    [stats]
  )
  const overallPct = overall.total > 0 ? Math.round((overall.correct / overall.total) * 100) : 0
  const dueNow = reviewMetrics?.totals.due_now ?? 0

  const composition = useMemo(() => {
    const totalQuestions = exercises.length
    let mastered = 0
    let struggling = 0
    let mixed = 0
    let tried = 0
    stats.forEach((row) => {
      if (!byId.has(row.exercise_id)) return
      tried += 1
      if (row.correct_attempts <= 0) struggling += 1
      else if (row.correct_attempts >= row.total_attempts) mastered += 1
      else mixed += 1
    })
    const notTried = Math.max(totalQuestions - tried, 0)
    return { totalQuestions, notTried, mastered, mixed, struggling }
  }, [byId, exercises.length, stats])

  const compositionSlices: CompositionSlice[] = [
    { key: 'not-tried', label: 'Not tried yet', value: composition.notTried, color: '#c3c2b7' },
    { key: 'mastered', label: 'Always correct', value: composition.mastered, color: '#0ca30c' },
    { key: 'mixed', label: 'Mixed results', value: composition.mixed, color: '#fab219' },
    { key: 'struggling', label: 'Always missed', value: composition.struggling, color: '#d03b3b' },
  ]

  const weakTopics = useMemo(() => {
    const byTopic = new Map<string, TopicSummary>()
    stats.forEach((row) => {
      const exercise = byId.get(row.exercise_id)
      const topic = exercise?.topic ?? 'Unknown topic'
      const current = byTopic.get(topic) ?? { topic, total: 0, correct: 0, accuracyPct: 0, dueNow: 0 }
      current.total += row.total_attempts
      current.correct += row.correct_attempts
      const dueAtMs = row.due_at ? Date.parse(row.due_at) : Number.NaN
      if (Number.isFinite(dueAtMs) && dueAtMs <= nowMs) current.dueNow += 1
      byTopic.set(topic, current)
    })

    return [...byTopic.values()]
      .map((topic) => ({
        ...topic,
        accuracyPct: topic.total > 0 ? Math.round((topic.correct / topic.total) * 100) : 0,
      }))
      .filter((topic) => topic.total > 0)
      .sort((a, b) => {
        if (a.accuracyPct !== b.accuracyPct) return a.accuracyPct - b.accuracyPct
        return b.total - a.total
      })
      .slice(0, 3)
  }, [byId, nowMs, stats])

  const filteredStats = useMemo(() => {
    const query = tableQuery.trim().toLowerCase()
    const rows = stats
      .map((row) => {
        const exercise = byId.get(row.exercise_id)
        const pct = row.total_attempts > 0 ? Math.round((row.correct_attempts / row.total_attempts) * 100) : 0
        return { row, exercise, pct }
      })
      .sort((a, b) => {
        const aDue = a.row.due_at ? Date.parse(a.row.due_at) : Number.POSITIVE_INFINITY
        const bDue = b.row.due_at ? Date.parse(b.row.due_at) : Number.POSITIVE_INFINITY
        if (aDue !== bDue) return aDue - bDue
        return b.row.total_attempts - a.row.total_attempts
      })

    if (!query) return rows

    return rows.filter(({ row, exercise }) => {
      const haystack = [
        exercise?.prompt ?? row.exercise_id,
        exercise?.topic ?? '',
        exercise?.subtopic ?? '',
        exercise?.group ?? '',
        exercise?.level ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [byId, stats, tableQuery])

  const totalPages = Math.max(1, Math.ceil(filteredStats.length / PAGE_SIZE))
  const safePage = Math.min(tablePage, totalPages)
  const pagedStats = filteredStats.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (loading) {
    return <div className="py-12 text-center text-gray-400">Loading progress...</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">
            <p>Could not load exercise stats.</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-slate-900">Your progress</h2>
          <p className="mt-1 text-sm text-slate-500">A simple view of what to practice next.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-gray-500">Questions answered</p>
            <p className="mt-1 text-3xl font-bold text-gray-800">{overall.total}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-gray-500">Accuracy</p>
            <p className={`mt-1 text-3xl font-bold ${overallPct >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
              {overallPct}%
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-gray-500">Due reviews</p>
            <p className="mt-1 text-3xl font-bold text-indigo-700">{reviewMetricsLoading ? '…' : dueNow}</p>
            {reviewMetricsError && <p className="mt-1 text-xs text-red-500">Could not load review count.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Question breakdown</h3>
        <p className="mt-1 text-sm text-slate-500">How the deck's questions split between not tried, mastered, and still shaky.</p>
        <div className="mt-4">
          <DeckCompositionPieChart slices={compositionSlices} total={composition.totalQuestions} centerLabel="questions" />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700">Weak topics</h3>
        <p className="mt-1 text-sm text-slate-500">Start your next session with the lowest-accuracy topics.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {weakTopics.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-3">
              Complete a session to discover weak topics.
            </div>
          ) : (
            weakTopics.map((topic) => (
              <div key={topic.topic} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <p className="font-semibold text-slate-900">{formatTopicLabel(topic.topic)}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {topic.correct}/{topic.total} correct · {topic.accuracyPct}%
                </p>
                {topic.dueNow > 0 && <p className="mt-1 text-xs font-semibold text-indigo-700">{topic.dueNow} due now</p>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Exercise details</h3>
          <input
            type="search"
            value={tableQuery}
            onChange={(e) => {
              setTableQuery(e.target.value)
              setTablePage(1)
            }}
            placeholder="Search by prompt, topic, subtopic, level"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 sm:max-w-sm"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {pagedStats.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              {stats.length === 0
                ? 'No progress recorded yet. Complete some exercises to populate this table.'
                : 'No exercises match the current search.'}
            </div>
          ) : (
            <div className="divide-y">
              {pagedStats.map(({ row, exercise, pct }) => {
                const dueAt = row.due_at ? new Date(row.due_at) : null
                const dueText =
                  !dueAt
                    ? 'No review scheduled yet'
                    : dueAt.getTime() <= nowMs
                      ? 'Due now'
                      : `Due ${dueAt.toLocaleDateString()}`
                return (
                  <div key={row.exercise_id} className="flex items-center justify-between p-4 text-sm">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="truncate font-medium text-gray-800">{exercise?.prompt ?? row.exercise_id}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {exercise
                          ? `${exercise.topic} / ${exercise.subtopic}${exercise.group ? ` · ${exercise.group}` : ''}${exercise.level ? ` · ${exercise.level}` : ''}`
                          : 'Unknown exercise'}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">{dueText}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-semibold ${pct >= 70 ? 'text-green-600' : 'text-red-500'}`}>{pct}%</p>
                      <p className="text-xs text-gray-400">
                        {row.correct_attempts}/{row.total_attempts}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {filteredStats.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>
              Showing {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filteredStats.length)} of{' '}
              {filteredStats.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setTablePage((page) => Math.max(1, page - 1))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setTablePage((page) => Math.min(totalPages, page + 1))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatTopicLabel(topic: string): string {
  return topic
    .split(' ')
    .map((word) => {
      if (!word) return word
      const [first, ...rest] = word
      return `${first.toLocaleUpperCase()}${rest.join('').toLocaleLowerCase()}`
    })
    .join(' ')
}
