import type { QuestionMedia } from '../types/deck'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// Media URLs from the backend are absolute paths (e.g. /static/images/einburgertest/foo.svg);
// resolve them against the API origin so this works whether the frontend is served from the
// same host as the API (local dev) or a different one (production).
function resolveMediaUrl(url: string | null): string | undefined {
  if (!url) return undefined
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

// Renders a question's illustration above its prompt (e.g. "what building is this?"), with alt
// text and an optional attribution caption. Used by both QuizCard (practice mode) and
// ExamSessionPage (exam mode).
//
// When `url` is null the picture itself has not been sourced yet, but `alt` still holds the
// official description of what it shows — which is what the question is answered from. That text
// is rendered in the image's place rather than dropped, so the question stays answerable; see
// docs/einburgertest-image-sourcing.md for which questions are still in that state.
export function QuestionMediaFigure({ media }: { media: QuestionMedia | undefined }) {
  if (!media) return null

  const src = resolveMediaUrl(media.url)

  if (!src) {
    if (!media.alt.trim()) return null
    return (
      <figure className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <figcaption className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Image description
        </figcaption>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{media.alt}</p>
      </figure>
    )
  }

  return (
    <figure className="space-y-1">
      <img src={src} alt={media.alt} className="max-h-64 w-auto rounded-xl border border-gray-200 object-contain" />
      {media.attribution && <figcaption className="text-xs text-gray-400">{media.attribution}</figcaption>}
    </figure>
  )
}
