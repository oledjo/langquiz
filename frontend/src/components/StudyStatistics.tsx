import { useMemo } from 'react'
import { useStatistics } from '../hooks/useProgress'
import type { DayActivity } from '../api/progressApi'

interface Props {
  deckId?: string
}

const cardClass = 'rounded-2xl border border-gray-100 bg-white p-6 shadow-sm'
const titleClass = 'text-sm font-semibold uppercase tracking-wide text-gray-500'

function dayTotal(day: DayActivity): number {
  return day.again + day.hard + day.good + day.easy
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function StackedReviewsChart({ days }: { days: DayActivity[] }) {
  const max = Math.max(1, ...days.map(dayTotal))
  return (
    <div className="flex h-32 items-end gap-[3px]">
      {days.map((day) => {
        const total = dayTotal(day)
        return (
          <div
            key={day.day}
            className="flex min-w-[2px] flex-1 flex-col justify-end overflow-hidden rounded-t"
            style={{ height: '100%' }}
            title={`${day.day}: ${total} reviews (${day.again} again, ${day.hard} hard, ${day.good} good, ${day.easy} easy)`}
          >
            <div className="flex flex-col justify-end" style={{ height: `${(total / max) * 100}%` }}>
              {day.easy > 0 && <div className="bg-sky-400" style={{ height: `${(day.easy / total) * 100}%` }} />}
              {day.good > 0 && <div className="bg-green-500" style={{ height: `${(day.good / total) * 100}%` }} />}
              {day.hard > 0 && <div className="bg-amber-400" style={{ height: `${(day.hard / total) * 100}%` }} />}
              {day.again > 0 && <div className="bg-red-400" style={{ height: `${(day.again / total) * 100}%` }} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReviewsLegend() {
  const items = [
    { label: 'Again', color: 'bg-red-400' },
    { label: 'Hard', color: 'bg-amber-400' },
    { label: 'Good', color: 'bg-green-500' },
    { label: 'Easy', color: 'bg-sky-400' },
  ]
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function FutureDueChart({ forecast }: { forecast: { day: string; count: number }[] }) {
  const weeks = useMemo(() => {
    const result: { label: string; value: number }[] = []
    for (let i = 0; i < forecast.length; i += 7) {
      const chunk = forecast.slice(i, i + 7)
      const value = chunk.reduce((sum, entry) => sum + entry.count, 0)
      result.push({ label: chunk[0]?.day.slice(5) ?? '', value })
    }
    return result
  }, [forecast])

  const max = Math.max(1, ...weeks.map((w) => w.value))

  return (
    <div className="flex h-32 items-end gap-1">
      {weeks.map((week) => (
        <div
          key={week.label}
          className="flex-1 rounded-t bg-indigo-500"
          style={{ height: `${(week.value / max) * 100}%`, minHeight: week.value > 0 ? 2 : 0 }}
          title={`Week of ${week.label}: ${week.value} due`}
        />
      ))}
    </div>
  )
}

function IntervalsChart({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <div className="overflow-x-auto">
      <div className="space-y-1" style={{ minWidth: `${buckets.length * 48}px` }}>
        <div className="flex h-28 items-end gap-2">
          {buckets.map((bucket) => (
            <div
              key={bucket.label}
              className="flex-1 rounded-t bg-violet-500"
              style={{ height: `${(bucket.count / max) * 100}%`, minHeight: bucket.count > 0 ? 2 : 0 }}
              title={`${bucket.label} days: ${bucket.count} cards`}
            />
          ))}
        </div>
        <div className="flex gap-2 text-xs text-slate-400">
          {buckets.map((bucket) => (
            <span key={bucket.label} className="flex-1 whitespace-nowrap text-center">
              {bucket.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function heatColor(count: number): string {
  if (count <= 0) return 'bg-slate-100'
  if (count <= 2) return 'bg-blue-200'
  if (count <= 5) return 'bg-blue-400'
  if (count <= 9) return 'bg-blue-600'
  return 'bg-blue-800'
}

function ActivityCalendar({ activity }: { activity: DayActivity[] }) {
  const weeks = useMemo(() => {
    const cells = activity.map((day) => ({ date: day.day, count: dayTotal(day) }))
    const firstDate = cells[0] ? new Date(`${cells[0].date}T00:00:00`) : new Date()
    const leadingBlanks = firstDate.getDay()
    const padded = [...Array.from({ length: leadingBlanks }, () => null), ...cells]
    const result: (typeof cells[number] | null)[][] = []
    for (let i = 0; i < padded.length; i += 7) {
      result.push(padded.slice(i, i + 7))
    }
    return result
  }, [activity])

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" style={{ width: 'max-content' }}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[3px]">
            {week.map((cell, dayIndex) =>
              cell ? (
                <div
                  key={cell.date}
                  className={`h-[11px] w-[11px] rounded-sm ${heatColor(cell.count)}`}
                  title={`${cell.date}: ${cell.count} reviews`}
                />
              ) : (
                <div key={dayIndex} className="h-[11px] w-[11px]" />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StudyStatistics({ deckId }: Props) {
  const { statistics, loading, error } = useStatistics(deckId)

  if (loading) {
    return <div className="py-8 text-center text-gray-400">Loading statistics...</div>
  }

  if (error || !statistics) {
    return (
      <div className={cardClass}>
        <p className="text-sm text-red-500">Could not load statistics.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Statistics</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={cardClass}>
          <h4 className={titleClass}>Today</h4>
          {statistics.today.total === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-400">No cards have been studied today.</p>
          ) : (
            <div className="mt-4 space-y-2">
              <StatRow label="Reviews" value={String(statistics.today.total)} />
              <StatRow
                label="Correct"
                value={`${statistics.today.correct}/${statistics.today.total} (${Math.round(
                  (statistics.today.correct / statistics.today.total) * 100
                )}%)`}
              />
            </div>
          )}
        </div>

        <div className={cardClass}>
          <h4 className={titleClass}>Future due</h4>
          <p className="mt-1 text-xs text-slate-400">Reviews due over the next 90 days.</p>
          <div className="mt-4">
            <FutureDueChart forecast={statistics.futureDue.forecast} />
          </div>
          <div className="mt-4 space-y-1.5">
            <StatRow label="Backlog (overdue)" value={String(statistics.futureDue.backlog)} />
            <StatRow label="Due tomorrow" value={String(statistics.futureDue.dueTomorrow)} />
            <StatRow label="Total (90 days)" value={String(statistics.futureDue.total)} />
            <StatRow label="Average" value={`${statistics.futureDue.averagePerDay.toFixed(1)} reviews/day`} />
          </div>
        </div>

        <div className={cardClass}>
          <h4 className={titleClass}>Calendar</h4>
          <p className="mt-1 text-xs text-slate-400">Reviews answered over the last year.</p>
          <div className="mt-4">
            <ActivityCalendar activity={statistics.activity} />
          </div>
          <div className="mt-3">
            <StatRow label="Active days" value={`${statistics.daysWithActivity} / ${statistics.activity.length}`} />
          </div>
        </div>

        <div className={cardClass}>
          <h4 className={titleClass}>Reviews</h4>
          <p className="mt-1 text-xs text-slate-400">Questions answered over the last 30 days.</p>
          <div className="mt-4">
            <StackedReviewsChart days={statistics.reviews.last30} />
          </div>
          <div className="mt-3">
            <ReviewsLegend />
          </div>
          <div className="mt-4 space-y-1.5">
            <StatRow
              label="Days studied"
              value={`${statistics.reviews.daysStudied} of ${statistics.reviews.daysInRange} (${Math.round(
                (statistics.reviews.daysStudied / Math.max(1, statistics.reviews.daysInRange)) * 100
              )}%)`}
            />
            <StatRow label="Total reviews" value={String(statistics.reviews.totalReviews)} />
            <StatRow label="Average" value={`${statistics.reviews.averagePerDay.toFixed(1)} reviews/day`} />
          </div>
        </div>

        <div className={cardClass}>
          <h4 className={titleClass}>Review intervals</h4>
          <p className="mt-1 text-xs text-slate-400">How long, in days, until reviewed questions come back up.</p>
          <div className="mt-4">
            <IntervalsChart buckets={statistics.reviewIntervals.buckets} />
          </div>
          <div className="mt-4">
            <StatRow
              label="Median interval"
              value={statistics.reviewIntervals.median === null ? '—' : `${Math.round(statistics.reviewIntervals.median)} days`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
