/**
 * Admin-uploaded question artwork: what a slot is, what may be uploaded into one, and how stored
 * uploads are merged onto the question payloads the API serves.
 *
 * The bytes themselves live in the `question_images` table (migration 016) and are served by
 * GET /api/question-images/:exerciseId/:slot — see routes/questionImages.ts.
 */

/** `question` = the illustration above the prompt; a number = the picture that IS that option. */
export type ImageSlot = { kind: 'question' } | { kind: 'option'; index: number }

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

// Kept to formats a browser renders in an <img> tag. SVG is included because the vendored
// Einbürgerungstest artwork is SVG; the serving route sends it with a locked-down CSP and
// nosniff, and nothing ever navigates to it directly.
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

/** Options beyond this are not real answer options — the cap matches the DB CHECK constraint. */
const MAX_OPTION_INDEX = 9

export function parseImageSlot(raw: string): ImageSlot | null {
  if (raw === 'question') return { kind: 'question' }
  if (!/^[0-9]$/.test(raw)) return null
  const index = Number(raw)
  return index <= MAX_OPTION_INDEX ? { kind: 'option', index } : null
}

export function slotToOptionIndex(slot: ImageSlot): number | null {
  return slot.kind === 'question' ? null : slot.index
}

export function optionIndexToSlot(optionIndex: number | null): string {
  return optionIndex === null ? 'question' : String(optionIndex)
}

export function normalizeContentType(raw: string | undefined): string | null {
  const type = (raw ?? '').split(';')[0].trim().toLowerCase()
  return ALLOWED_IMAGE_TYPES.includes(type) ? type : null
}

/** A row of `question_images` without its bytes — everything needed to describe or link to it. */
export interface StoredQuestionImage {
  exercise_id: string
  option_index: number | null
  alt: string
  attribution: string | null
  updated_at: string | Date
}

interface QuestionMediaPayload {
  kind: 'image'
  url: string | null
  alt: string
  attribution?: string
}

export function questionImageUrl(image: StoredQuestionImage): string {
  const slot = optionIndexToSlot(image.option_index)
  // The version marker lets the browser cache aggressively while a re-upload still shows up.
  const version = Math.floor(new Date(image.updated_at).getTime() / 1000)
  return `/api/question-images/${encodeURIComponent(image.exercise_id)}/${slot}?v=${version}`
}

function toMedia(image: StoredQuestionImage): QuestionMediaPayload {
  return {
    kind: 'image',
    url: questionImageUrl(image),
    alt: image.alt,
    ...(image.attribution ? { attribution: image.attribution } : {}),
  }
}

/**
 * Layers uploaded artwork onto the question payloads read from `exercises`/`user_exercises`.
 *
 * An upload wins over whatever the content import put in the row: the import is a bulk operation
 * over a vendored snapshot, an upload is a person deciding what this question should show.
 * Payloads are copied rather than mutated so callers can keep the DB rows untouched.
 */
export function mergeQuestionImages<T extends Record<string, unknown>>(
  payloads: T[],
  images: StoredQuestionImage[]
): T[] {
  if (images.length === 0) return payloads

  const byExerciseId = new Map<string, StoredQuestionImage[]>()
  for (const image of images) {
    const bucket = byExerciseId.get(image.exercise_id)
    if (bucket) bucket.push(image)
    else byExerciseId.set(image.exercise_id, [image])
  }

  return payloads.map((payload) => {
    const id = typeof payload.id === 'string' ? payload.id : null
    const forQuestion = id ? byExerciseId.get(id) : undefined
    if (!forQuestion) return payload

    const merged: Record<string, unknown> = { ...payload }
    const optionCount = Array.isArray(payload.options) ? payload.options.length : 0
    const existingOptionImages = Array.isArray(payload.optionImages)
      ? (payload.optionImages as (QuestionMediaPayload | null)[])
      : null

    for (const image of forQuestion) {
      if (image.option_index === null) {
        merged.media = toMedia(image)
        continue
      }
      if (image.option_index >= optionCount) continue

      const optionImages: (QuestionMediaPayload | null)[] = Array.isArray(merged.optionImages)
        ? [...(merged.optionImages as (QuestionMediaPayload | null)[])]
        : Array.from({ length: optionCount }, (_, index) => existingOptionImages?.[index] ?? null)

      // A slot with neither a picture nor a description renders as a plain text option.
      optionImages[image.option_index] = toMedia(image)
      merged.optionImages = optionImages.map(
        (entry) => entry ?? { kind: 'image' as const, url: null, alt: '' }
      )
    }

    return merged as T
  })
}
