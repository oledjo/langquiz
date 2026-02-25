import { useEffect, useMemo, useState } from 'react'
import {
  approveSharedQuestion,
  deleteAdminQuestion,
  fetchAdminQuestions,
  fetchShareQueue,
  rejectSharedQuestion,
  updateAdminQuestion,
  type AdminQuestion,
} from '../api/adminApi'
import type { Exercise } from '../types/exercise'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

interface Props {
  onChanged?: () => Promise<void> | void
}

function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error'
}

export function AdminQuestions({ onChanged }: Props) {
  const [items, setItems] = useState<AdminQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [queue, setQueue] = useState<AdminQuestion[]>([])
  const [editing, setEditing] = useState<AdminQuestion | null>(null)
  const [editorText, setEditorText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, pending] = await Promise.all([fetchAdminQuestions(), fetchShareQueue()])
      setItems(data)
      setQueue(pending)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const exercise = item.exercise
      const blob = [
        item.exerciseId,
        item.source,
        item.ownerEmail ?? '',
        exercise.topic,
        exercise.subtopic,
        exercise.prompt,
        exercise.context ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [items, query])

  const startEdit = (item: AdminQuestion) => {
    setEditing(item)
    setEditorText(JSON.stringify(item.exercise, null, 2))
  }

  const saveEdit = async () => {
    if (!editing) return
    let parsed: unknown
    try {
      parsed = JSON.parse(editorText)
    } catch {
      setError('Invalid JSON in editor.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateAdminQuestion(editing.source, editing.recordId, parsed as Exercise)
      setEditing(null)
      await load()
      await onChanged?.()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: AdminQuestion) => {
    const ok = window.confirm(`Delete "${item.exerciseId}" (${item.source})?`)
    if (!ok) return
    setError(null)
    try {
      await deleteAdminQuestion(item.source, item.recordId)
      await load()
      await onChanged?.()
    } catch (err) {
      setError(extractErrorMessage(err))
    }
  }

  const moderate = async (recordId: number, action: 'approve' | 'reject') => {
    setError(null)
    try {
      if (action === 'approve') {
        await approveSharedQuestion(recordId)
      } else {
        await rejectSharedQuestion(recordId)
      }
      await load()
      await onChanged?.()
    } catch (err) {
      setError(extractErrorMessage(err))
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Admin: Question Bank</h2>
        <button
          onClick={() => void load()}
          className={['rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200', focusRingClass].join(' ')}
        >
          Refresh
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by topic, prompt, source, owner email..."
        className={['w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700', focusRingClass].join(' ')}
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading questions...</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">
              Pending approvals ({queue.length})
            </h3>
            {queue.length === 0 ? (
              <p className="text-xs text-amber-800">No pending submissions.</p>
            ) : (
              <div className="space-y-2">
                {queue.map((item) => (
                  <div
                    key={`queue-${item.recordId}`}
                    className="rounded-lg border border-amber-200 bg-white p-2.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.exercise.prompt}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.exercise.topic} / {item.exercise.subtopic} · {item.exercise.type}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        owner: {item.ownerEmail ?? '-'} · id: {item.exerciseId}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => void moderate(item.recordId, 'approve')}
                        className={['rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100', focusRingClass].join(' ')}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void moderate(item.recordId, 'reject')}
                        className={['rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100', focusRingClass].join(' ')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        <div className="divide-y rounded-xl border border-slate-200 bg-white overflow-hidden">
          {filtered.map((item) => (
            <div key={`${item.source}-${item.recordId}`} className="p-3 sm:p-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.exercise.prompt}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.exercise.topic} / {item.exercise.subtopic} · {item.exercise.type} · {item.exercise.level ?? '-'} · {item.exercise.group ?? '-'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  source: {item.source}
                  {item.ownerEmail ? ` · owner: ${item.ownerEmail}` : ''}
                  {item.shareStatus ? ` · share: ${item.shareStatus}` : ''}
                  {' · '}id: {item.exerciseId}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEdit(item)}
                  className={['rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50', focusRingClass].join(' ')}
                >
                  Edit
                </button>
                <button
                  onClick={() => void remove(item)}
                  className={['rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100', focusRingClass].join(' ')}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-4 text-sm text-slate-500">No questions found.</div>
          )}
        </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-800">Edit question JSON</h3>
              <button
                onClick={() => setEditing(null)}
                className={['rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200', focusRingClass].join(' ')}
              >
                Close
              </button>
            </div>
            <textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              rows={16}
              className={['w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-700 font-mono', focusRingClass].join(' ')}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className={['rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50', focusRingClass].join(' ')}
              >
                Cancel
              </button>
              <button
                onClick={() => void saveEdit()}
                disabled={saving}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                  focusRingClass,
                  saving ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
                ].join(' ')}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
