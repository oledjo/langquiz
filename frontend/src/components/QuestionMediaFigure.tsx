import type { QuestionMedia } from '../types/deck'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// Media URLs from the backend are absolute paths (e.g. /static/images/einburgertest/foo.svg);
// resolve them against the API origin so this works whether the frontend is served from the
// same host as the API (local dev) or a different one (production).
function resolveMediaUrl(url: string | null): string | undefined {
  if (!url) return undefined
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

// Renders a single illustrative image above a question's prompt (e.g. "what building is this?"),
// with alt text and an optional small attribution caption. Used by both QuizCard (practice mode)
// and ExamSessionPage (exam mode). Renders nothing when there's no resolvable image URL — this
// happens for Einbürgerungstest questions whose source catalog only has a text description and no
// sourced image yet (media.url is null).
export function QuestionMediaFigure({ media }: { media: QuestionMedia | undefined }) {
  const src = media ? resolveMediaUrl(media.url) : undefined
  if (!media || !src) return null

  return (
    <figure className="space-y-1">
      <img src={src} alt={media.alt} className="max-h-64 w-auto rounded-xl border border-gray-200 object-contain" />
      {media.attribution && <figcaption className="text-xs text-gray-400">{media.attribution}</figcaption>}
    </figure>
  )
}
