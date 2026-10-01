import { useState, type FormEvent } from 'react'
import { saveStudySettings } from '../api/studyApi'
import { useStudyToday } from '../hooks/useStudyToday'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

/** Daily review/new limits: today's usage plus a small form to change them. */
export function DailyLimitsCard() {
  const { today, loading, refresh } = useStudyToday()
  const [editing, setEditing] = useState<{ review: string; new: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || !today) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const dailyReviewLimit = Number(editing.review)
    const dailyNewLimit = Number(editing.new)
    if (!Number.isInteger(dailyReviewLimit) || dailyReviewLimit < 0 || dailyReviewLimit > 9999) {
      setError('Reviews per day must be a whole number from 0 to 9999.')
      return
    }
    if (!Number.isInteger(dailyNewLimit) || dailyNewLimit < 0 || dailyNewLimit > 999) {
      setError('New questions per day must be a whole number from 0 to 999.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveStudySettings({ dailyReviewLimit, dailyNewLimit })
      await refresh()
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Daily limits</h3>
          <p className="mt-1 text-sm text-slate-600">
            Reviews: {today.reviewedToday} of {today.dailyReviewLimit} · New: {today.newToday} of {today.dailyNewLimit}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing({ review: String(today.dailyReviewLimit), new: String(today.dailyNewLimit) })}
            className={['rounded-lg px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50', focusRingClass].join(' ')}
          >
            Change
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Reviews per day
            <input
              type="number"
              min={0}
              max={9999}
              value={editing.review}
              onChange={(event) => setEditing({ ...editing, review: event.target.value })}
              className="mt-1 block w-28 rounded-lg border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm text-slate-600">
            New questions per day
            <input
              type="number"
              min={0}
              max={999}
              value={editing.new}
              onChange={(event) => setEditing({ ...editing, new: event.target.value })}
              className="mt-1 block w-28 rounded-lg border border-slate-300 px-2 py-1"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className={['rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60', focusRingClass].join(' ')}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setError(null)
            }}
            className={['rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50', focusRingClass].join(' ')}
          >
            Cancel
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
