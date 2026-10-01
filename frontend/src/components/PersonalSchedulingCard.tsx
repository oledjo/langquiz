import { useCallback, useEffect, useState } from 'react'
import { fetchSchedulerStatus, optimizeScheduler, type SchedulerStatus } from '../api/studyApi'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

/** Fit the review scheduler (FSRS) to the user's own forgetting curve once there is enough history. */
export function PersonalSchedulingCard() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setStatus(await fetchSchedulerStatus())
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!status) return null
  const ready = status.availableReviews >= status.requiredReviews

  const run = async () => {
    setRunning(true)
    setMessage(null)
    try {
      await optimizeScheduler()
      await load()
      setMessage('Done — your reviews are now scheduled for how you remember.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to personalize scheduling.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Personal scheduling</h3>
      <p className="mt-1 text-sm text-slate-600">
        {status.personalized
          ? `Review intervals are tuned to your memory (from ${status.reviewsUsed} reviews, ${new Date(status.computedAt ?? '').toLocaleDateString()}).`
          : 'Review intervals use standard settings. With enough history, they can be tuned to how you remember.'}
      </p>
      {ready ? (
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className={['mt-3 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60', focusRingClass].join(' ')}
        >
          {running ? 'Tuning…' : status.personalized ? 'Re-tune with my latest reviews' : 'Tune to my memory'}
        </button>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Available after {status.requiredReviews} reviews spread over several days — you have {status.availableReviews}.
        </p>
      )}
      {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
    </div>
  )
}
