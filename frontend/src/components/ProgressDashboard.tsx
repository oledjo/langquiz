import { useEffect, useMemo, useState } from 'react'
import { useProgressSummary, useStats } from '../hooks/useProgress'
import type { Exercise } from '../types/exercise'
import type { ProgressBarPoint } from '../api/progressApi'
import {
  fetchRetentionPreferences,
  updateRetentionPreferences,
  type RetentionPreferences,
} from '../api/retentionApi'

interface Props {
  exercises?: Exercise[]
}

const DAILY_GOAL_STORAGE_KEY = 'langquiz.daily-goal'
const PAGE_SIZE = 12
const DAILY_GOAL_OPTIONS = [5, 10, 15, 20]

export function ProgressDashboard({ exercises = [] }: Props) {
  const { stats, loading, error } = useStats()
  const { summary, loading: summaryLoading, error: summaryError } = useProgressSummary()
  const [preferences, setPreferences] = useState<RetentionPreferences | null>(null)
  const [prefsMessage, setPrefsMessage] = useState('')
  const [prefsError, setPrefsError] = useState('')
  const [savingPreferenceKey, setSavingPreferenceKey] = useState<string | null>(null)
  const [dailyGoal, setDailyGoal] = useState(() => {
    const raw = localStorage.getItem(DAILY_GOAL_STORAGE_KEY)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
  })
  const [tableQuery, setTableQuery] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises])

  useEffect(() => {
    localStorage.setItem(DAILY_GOAL_STORAGE_KEY, String(dailyGoal))
  }, [dailyGoal])

  useEffect(() => {
    fetchRetentionPreferences()
      .then((next) => {
        setPreferences(next)
        setPrefsError('')
      })
      .catch(() => {
        setPrefsError('Could not load email preferences.')
      })
  }, [])

  useEffect(() => {
    setTablePage(1)
  }, [tableQuery])

  const overall = useMemo(
    () => ({
      total: stats.reduce((sum, row) => sum + row.total_attempts, 0),
      correct: stats.reduce((sum, row) => sum + row.correct_attempts, 0),
    }),
    [stats]
  )
  const overallPct = overall.total > 0 ? Math.round((overall.correct / overall.total) * 100) : 0
  const bars = summary?.bars ?? []
  const todayBar = bars.at(-1)
  const todayTotal = todayBar?.total ?? 0
  const remainingToday = Math.max(0, dailyGoal - todayTotal)
  const streaks = useMemo(() => computeGoalStreaks(bars, dailyGoal), [bars, dailyGoal])

  const filteredStats = useMemo(() => {
    const query = tableQuery.trim().toLowerCase()
    const rows = stats
      .map((row) => {
        const exercise = byId.get(row.exercise_id)
        const pct =
          row.total_attempts > 0 ? Math.round((row.correct_attempts / row.total_attempts) * 100) : 0
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

  if (loading && summaryLoading) {
    return <div className="py-12 text-center text-gray-400">Loading progress...</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Daily practice target</h3>
            <p className="mt-1 text-sm text-gray-500">
              Set a daily question goal and use it to measure your streak.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAILY_GOAL_OPTIONS.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => setDailyGoal(goal)}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  dailyGoal === goal
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700',
                ].join(' ')}
              >
                {goal}/day
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-gray-500">Today</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {todayTotal}/{dailyGoal}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {remainingToday === 0 ? 'Goal reached today.' : `${remainingToday} question(s) left today.`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-gray-500">Current streak</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{streaks.current}</p>
            <p className="mt-1 text-sm text-slate-600">Consecutive days meeting your goal.</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-gray-500">Best streak</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{streaks.best}</p>
            <p className="mt-1 text-sm text-slate-600">Based on the last 14 tracked days.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Retention emails</h3>
          <p className="mt-1 text-sm text-gray-500">
            Control comeback reminders and weekly weak-topic summaries.
          </p>
        </div>
        {preferences ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['email_enabled', 'Enable all emails'],
              ['reminder_emails_enabled', 'Comeback reminders'],
              ['weekly_summary_enabled', 'Weekly weak-topic summary'],
              ['marketing_emails_enabled', 'Product updates'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(preferences[key as keyof RetentionPreferences])}
                  disabled={savingPreferenceKey !== null}
                  onChange={async (e) => {
                    const next = { ...preferences, [key]: e.target.checked }
                    setPrefsMessage('')
                    setPrefsError('')
                    setSavingPreferenceKey(key)
                    try {
                      const saved = await updateRetentionPreferences(next)
                      setPreferences(saved)
                      setPrefsMessage('Email preferences saved.')
                    } catch {
                      setPrefsError('Could not save email preferences. Your selection was not changed.')
                    } finally {
                      setSavingPreferenceKey(null)
                    }
                  }}
                />
                <span>{label}</span>
                {savingPreferenceKey === key && <span className="text-xs text-slate-400">Saving...</span>}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Loading email preferences...</p>
        )}
        {prefsMessage && <p className="text-xs text-blue-700">{prefsMessage}</p>}
        {prefsError && <p className="text-xs text-red-600">{prefsError}</p>}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">
            <p>Could not load exercise stats.</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}
        <div className="flex gap-8">
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
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">By Period</h3>
        {summaryError && <p className="text-sm text-red-500">Could not load period stats: {summaryError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                <p className="mt-1 text-2xl font-bold text-gray-800">{total}</p>
                <p className={`mt-1 text-sm ${pct >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
                  {correct}/{total} correct ({pct}%)
                </p>
              </div>
            )
          })}
        </div>

        <div>
          <p className="mb-2 text-xs text-gray-500">
            Daily activity (last 14 days) against your {dailyGoal}-question goal
          </p>
          {summaryLoading ? (
            <p className="text-sm text-gray-400">Loading chart...</p>
          ) : (
            <div className="flex h-48 items-end gap-1 rounded-xl border border-gray-100 bg-gray-50 p-3">
              {bars.map((bar) => {
                const maxTotal = Math.max(dailyGoal, 1, ...bars.map((item) => item.total))
                const height = Math.max(8, Math.round((bar.total / maxTotal) * 100))
                const hitGoal = bar.total >= dailyGoal
                return (
                  <div key={bar.day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 h-full">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-t-sm ${hitGoal ? 'bg-emerald-500/85' : bar.total > 0 ? 'bg-blue-500/85' : 'bg-slate-300/90'}`}
                        style={{ height: `${height}%` }}
                        title={`${bar.day}: ${bar.correct}/${bar.total}`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{bar.day.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">By Exercise</h3>
          <input
            type="search"
            value={tableQuery}
            onChange={(e) => setTableQuery(e.target.value)}
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
                    : dueAt.getTime() <= Date.now()
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

function computeGoalStreaks(bars: ProgressBarPoint[], dailyGoal: number): { current: number; best: number } {
  if (bars.length === 0) return { current: 0, best: 0 }

  let current = 0
  for (let i = bars.length - 1; i >= 0; i -= 1) {
    if (bars[i].total >= dailyGoal) current += 1
    else break
  }

  let best = 0
  let running = 0
  bars.forEach((bar) => {
    if (bar.total >= dailyGoal) {
      running += 1
      best = Math.max(best, running)
    } else {
      running = 0
    }
  })

  return { current, best }
}
