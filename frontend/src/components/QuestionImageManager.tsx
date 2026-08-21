import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteQuestionImage,
  fetchQuestionImages,
  questionImageSrc,
  updateQuestionImageText,
  uploadQuestionImage,
  type AdminQuestionImage,
} from '../api/adminApi'
import type { Exercise } from '../types/exercise'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

interface Slot {
  /** Matches the API's slot segment: "question", or the option index as a string. */
  id: string
  label: string
  /** Description already stored on the question, used as the starting alt text. */
  defaultAlt: string
}

function buildSlots(exercise: Exercise): Slot[] {
  const options = 'options' in exercise && Array.isArray(exercise.options) ? exercise.options : []

  return [
    { id: 'question', label: 'Question image', defaultAlt: exercise.media?.alt ?? '' },
    ...options.map((option, index) => ({
      id: String(index),
      label: `Option ${index + 1} — ${option}`,
      defaultAlt: exercise.optionImages?.[index]?.alt ?? '',
    })),
  ]
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

/**
 * Per-question artwork editor: one slot for the illustration above the prompt, one per answer
 * option (for "which of these four pictures" questions). Uploads are stored separately from the
 * question row, so re-importing the deck does not undo them.
 */
export function QuestionImageManager({ exercise, onChanged }: { exercise: Exercise; onChanged?: () => void }) {
  const slots = useMemo(() => buildSlots(exercise), [exercise])
  const [images, setImages] = useState<AdminQuestionImage[]>([])
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({})
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const stored = await fetchQuestionImages(exercise.id)
      setImages(stored)
      setAltDrafts(
        Object.fromEntries(
          buildSlots(exercise).map((slot) => [
            slot.id,
            stored.find((image) => image.slot === slot.id)?.alt ?? slot.defaultAlt,
          ])
        )
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images.')
    } finally {
      setLoading(false)
    }
  }, [exercise])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (slotId: string, action: () => Promise<void>) => {
    setBusySlot(slotId)
    setError(null)
    try {
      await action()
      await load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusySlot(null)
    }
  }

  const upload = (slot: Slot, file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`"${file.name}" is ${formatSize(file.size)} — the limit is 2 MB.`)
      return
    }
    void run(slot.id, () => uploadQuestionImage(exercise.id, slot.id, file, altDrafts[slot.id] ?? slot.defaultAlt))
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-800">Images</h4>
        <p className="mt-0.5 text-xs text-slate-500">
          PNG, JPEG, WebP, GIF or SVG, up to 2 MB. The description is shown to learners when a slot
          has no picture, and is the image’s alt text when it does.
        </p>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {loading ? (
        <p className="text-xs text-slate-500">Loading images…</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => {
            const stored = images.find((image) => image.slot === slot.id)
            const busy = busySlot === slot.id
            const draft = altDrafts[slot.id] ?? ''

            return (
              <div key={slot.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex h-24 w-32 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                    {stored ? (
                      <img
                        src={questionImageSrc(exercise.id, slot.id, stored.updatedAt)}
                        alt={stored.alt || slot.label}
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    ) : (
                      <span className="px-2 text-center text-xs text-slate-400">No image</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-xs font-semibold text-slate-700">{slot.label}</p>

                    <textarea
                      value={draft}
                      onChange={(e) => setAltDrafts((prev) => ({ ...prev, [slot.id]: e.target.value }))}
                      rows={2}
                      placeholder="What this picture shows"
                      className={['w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-700', focusRingClass].join(' ')}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={[
                          'cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50',
                          busy ? 'cursor-not-allowed opacity-60' : '',
                        ].join(' ')}
                      >
                        {stored ? 'Replace image' : 'Upload image'}
                        <input
                          type="file"
                          accept={ACCEPTED_TYPES}
                          disabled={busy}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            // Reset so picking the same file again still fires a change event.
                            e.target.value = ''
                            if (file) upload(slot, file)
                          }}
                        />
                      </label>

                      {stored && (
                        <>
                          <button
                            type="button"
                            disabled={busy || draft === stored.alt}
                            onClick={() =>
                              void run(slot.id, () => updateQuestionImageText(exercise.id, slot.id, draft))
                            }
                            className={[
                              'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
                              focusRingClass,
                            ].join(' ')}
                          >
                            Save description
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Remove the image from "${slot.label}"?`)) return
                              void run(slot.id, () => deleteQuestionImage(exercise.id, slot.id))
                            }}
                            className={[
                              'rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60',
                              focusRingClass,
                            ].join(' ')}
                          >
                            Remove
                          </button>
                          <span className="text-xs text-slate-400">
                            {stored.contentType.replace('image/', '')} · {formatSize(stored.size)}
                          </span>
                        </>
                      )}
                      {busy && <span className="text-xs text-slate-500">Working…</span>}
                    </div>

                    {!stored && (
                      <p className="text-xs text-slate-500">
                        Used as the description of the picture you upload. Until there is one,
                        learners see the description stored in the question JSON below.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
