export interface EinburgertestQuestionImage {
  path: string | null
  descriptionDe: string
  attribution: string | null
}

export interface EinburgertestQuestion {
  id: string
  officialQuestionNumber: number
  scope: 'general' | 'bavaria'
  promptDe: string
  answersDe: string[]
  correctAnswerIndex: number
  image: EinburgertestQuestionImage | null
  promptRu: string
  answersRu: string[]
  explanationRu: string
  explanationSourceUrl: string
  sourceUrl: string
  sourceVersion: string
  reviewStatus: string
  reviewedAt: string | null
}

export interface MappedExerciseImage {
  kind: 'image'
  url: string | null
  alt: string
  attribution?: string
}

export interface MappedExercise {
  id: string
  type: 'selection'
  topic: string
  subtopic: string
  language: string
  difficulty: 3
  prompt: string
  options: string[]
  answer: number
  explanation: string
  facets: { scope: string }
  translations: { ru: { prompt: string; options: string[] } }
  media?: MappedExerciseImage
  // One entry per answer option, parallel to `options`, for questions whose options are pictures
  // ("Bild 1" … "Bild 4"). This mapper only ever fills them with `url: null` plus that option's
  // official description — real artwork is layered on later from the `question_images` table,
  // which is the single place pictures come from. See services/questionImages.ts.
  optionImages?: MappedExerciseImage[]
}

/** "Bild 1" / "1" — the answer labels of a question whose options ARE the pictures. */
const PICKER_OPTION_LABEL = /^(?:Bild\s*)?([1-9])$/i

export interface SplitImageDescription {
  /** Text before the first per-option segment; empty when the description starts with one. */
  intro: string
  optionDescriptions: string[]
}

/**
 * Splits an image description that enumerates one picture per answer option ("Bild 1: … Bild 2: …"
 * or "1. … 2. …") into a description per option, so a picker question stays answerable when the
 * pictures themselves have not been sourced — the learner reads "Bild 3" *and* what Bild 3 shows.
 * This is the same accessible alternative BAMF publishes for these questions.
 *
 * Returns null unless the question really is a picker: every option label has to be "Bild N" or
 * "N" numbered 1..n in order, and every segment marker has to appear, in order, with text after
 * it. That narrowness is deliberate — a bare `N.` marker would otherwise also match a date like
 * "am 3. Oktober" inside prose. The mapper test pins the result for every real picker question in
 * the catalog.
 */
export function splitImageDescriptionByOption(
  description: string,
  options: string[]
): SplitImageDescription | null {
  if (options.length < 2) return null

  const isPicker = options.every((option, index) => {
    const match = option.trim().match(PICKER_OPTION_LABEL)
    return match !== null && Number(match[1]) === index + 1
  })
  if (!isPicker) return null

  const markers: { start: number; end: number }[] = []
  let searchFrom = 0

  for (let n = 1; n <= options.length; n += 1) {
    const marker = new RegExp(`(?:^|\\s)(?:Bild\\s*)?${n}[.:]\\s`)
    const match = marker.exec(description.slice(searchFrom))
    if (!match) return null
    const start = searchFrom + match.index
    const end = start + match[0].length
    markers.push({ start, end })
    searchFrom = end
  }

  const optionDescriptions = markers.map(({ end }, index) => {
    const next = markers[index + 1]
    return description.slice(end, next ? next.start : undefined).trim()
  })
  if (optionDescriptions.some((text) => text.length < 20)) return null

  return { intro: description.slice(0, markers[0].start).trim(), optionDescriptions }
}

export function mapEinburgertestQuestion(question: EinburgertestQuestion): MappedExercise {
  const split = question.image
    ? splitImageDescriptionByOption(question.image.descriptionDe, question.answersDe)
    : null

  const describedImage = ((): Pick<MappedExercise, 'media' | 'optionImages'> => {
    if (!question.image) return {}
    if (split) {
      return {
        optionImages: split.optionDescriptions.map((alt) => ({ kind: 'image' as const, url: null, alt })),
        ...(split.intro ? { media: { kind: 'image' as const, url: null, alt: split.intro } } : {}),
      }
    }
    return { media: { kind: 'image' as const, url: null, alt: question.image.descriptionDe } }
  })()

  const base: MappedExercise = {
    id: question.id,
    type: 'selection',
    topic: 'einbuergerungstest',
    subtopic: question.scope,
    language: 'de',
    difficulty: 3,
    prompt: question.promptDe,
    options: question.answersDe,
    answer: question.correctAnswerIndex,
    explanation: question.explanationRu,
    facets: { scope: question.scope },
    translations: {
      ru: {
        prompt: question.promptRu,
        options: question.answersRu,
      },
    },
    ...describedImage,
  }

  return base
}
