import { useEffect, useMemo, useState } from 'react'
import {
  approveAllSharedQuestions,
  approveSharedQuestion,
  deleteAdminQuestion,
  fetchAdminAuditLog,
  fetchAdminQuestions,
  fetchShareQueue,
  rejectSharedQuestion,
  updateAdminQuestion,
  type AdminAuditEntry,
  type AdminQuestion,
} from '../api/adminApi'
import type { Exercise } from '../types/exercise'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
const PAGE_SIZE = 12

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
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[]>([])
  const [editing, setEditing] = useState<AdminQuestion | null>(null)
  const [editorText, setEditorText] = useState('')
  const [saving, setSaving] = useState(false)
  const [moderationBusy, setModerationBusy] = useState(false)
  const [tablePage, setTablePage] = useState(1)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, pending, audit] = await Promise.all([
        fetchAdminQuestions(),
        fetchShareQueue(),
        fetchAdminAuditLog(),
      ])
      setItems(data)
      setQueue(pending)
      setAuditLog(audit)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setTablePage(1)
  }, [query])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const exercise = item.exercise
      const blob = [
        item.exerciseId,
        item.source,
        item.ownerEmail ?? '',
        item.rejectionReason ?? '',
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(tablePage, totalPages)
  const pagedItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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
    setModerationBusy(true)
    try {
      if (action === 'approve') {
        await approveSharedQuestion(recordId)
      } else {
        const reason = window.prompt('Rejection reason (stored in moderation history):', '')
        if (!reason || !reason.trim()) {
          setModerationBusy(false)
          return
        }
        await rejectSharedQuestion(recordId, reason.trim())
      }
      await load()
      await onChanged?.()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setModerationBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-amber-900">Pending approvals ({queue.length})</h3>
              {queue.length > 0 && (
                <button
                  onClick={async () => {
                    const ok = window.confirm(`Approve all ${queue.length} pending submissions?`)
                    if (!ok) return
                    setModerationBusy(true)
                    setError(null)
                    try {
                      await approveAllSharedQuestions(queue.map((item) => item.recordId))
                      await load()
                      await onChanged?.()
                    } catch (err) {
                      setError(extractErrorMessage(err))
                    } finally {
                      setModerationBusy(false)
                    }
                  }}
                  disabled={moderationBusy}
                  className={['rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60', focusRingClass].join(' ')}
                >
                  Approve all pending
                </button>
              )}
            </div>
            {queue.length === 0 ? (
              <p className="text-xs text-amber-800">No pending submissions.</p>
            ) : (
              <div className="space-y-2">
                {queue.map((item) => (
                  <div
                    key={`queue-${item.recordId}`}
                    className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-2.5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.exercise.prompt}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.exercise.topic} / {item.exercise.subtopic} · {item.exercise.type}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        owner: {item.ownerEmail ?? '-'} · id: {item.exerciseId}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => void moderate(item.recordId, 'approve')}
                        disabled={moderationBusy}
                        className={['rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60', focusRingClass].join(' ')}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void moderate(item.recordId, 'reject')}
                        disabled={moderationBusy}
                        className={['rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60', focusRingClass].join(' ')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="divide-y overflow-hidden rounded-xl border border-slate-200 bg-white">
            {pagedItems.map((item) => (
              <div
                key={`${item.source}-${item.recordId}`}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.exercise.prompt}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.exercise.topic} / {item.exercise.subtopic} · {item.exercise.type} · {item.exercise.level ?? '-'} · {item.exercise.group ?? '-'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    source: {item.source}
                    {item.ownerEmail ? ` · owner: ${item.ownerEmail}` : ''}
                    {item.shareStatus ? ` · share: ${item.shareStatus}` : ''}
                    {item.reviewerEmail ? ` · reviewed by: ${item.reviewerEmail}` : ''}
                    {' · '}id: {item.exerciseId}
                  </p>
                  {item.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">Rejection reason: {item.rejectionReason}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
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
            {filtered.length === 0 && <div className="p-4 text-sm text-slate-500">No questions found.</div>}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <p>
                Showing {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length}
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

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Audit log</h3>
            {auditLog.length === 0 ? (
              <p className="text-xs text-slate-500">No moderation actions recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">
                      {entry.action} · {entry.exerciseId}
                    </p>
                    <p className="mt-0.5">
                      {entry.actorEmail ?? 'Unknown admin'} · {new Date(entry.createdAt).toLocaleString()} · {entry.source} #{entry.recordId}
                    </p>
                    {entry.note && <p className="mt-1 text-slate-700">{entry.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-3xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
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
              className={['w-full rounded-lg border border-slate-300 p-3 font-mono text-xs text-slate-700', focusRingClass].join(' ')}
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
                  saving ? 'cursor-not-allowed bg-slate-300' : 'bg-blue-600 hover:bg-blue-700',
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
