/**
 * Server-side validation for questions a user writes (or accepts from AI generation) into their
 * own deck. It produces the exercise JSON stored in `user_exercises.data`, in the same shape the
 * clients already read (see frontend/src/types/exercise.ts).
 *
 * Deliberately subject-neutral: unlike the German-specific rules on bundled free-type content,
 * any non-empty answer text is allowed, because a user deck can be about anything.
 */

export type ExerciseType = 'selection' | 'multiselect' | 'free-type'

export const LIMITS = {
  prompt: 1000,
  option: 300,
  minOptions: 2,
  maxOptions: 8,
  explanation: 2000,
  hint: 500,
  context: 1000,
  freeAnswer: 200,
  maxFreeAnswers: 10,
  topic: 120,
} as const

interface ExerciseBase {
  type: ExerciseType
  topic: string
  subtopic: string
  language: string
  difficulty: 1 | 2 | 3 | 4 | 5
  prompt: string
  context?: string
  hint?: string
  explanation?: string
}

export type StoredExercise =
  | (ExerciseBase & { type: 'selection'; options: string[]; answer: number })
  | (ExerciseBase & { type: 'multiselect'; options: string[]; answers: number[] })
  | (ExerciseBase & { type: 'free-type'; answers: string[]; caseSensitive: boolean })

export interface ExerciseDefaults {
  topic: string
  language: string
}

export type NormalizeResult = { exercise: StoredExercise } | { error: string }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown, max: number, field: string): { value?: string } | { error: string } {
  const v = text(value)
  if (!v) return {}
  if (v.length > max) return { error: `${field} must be at most ${max} characters.` }
  return { value: v }
}

function options(value: unknown): { options: string[] } | { error: string } {
  if (!Array.isArray(value)) return { error: 'options must be an array of strings.' }
  const cleaned = value.map(text)
  if (cleaned.length < LIMITS.minOptions || cleaned.length > LIMITS.maxOptions) {
    return { error: `A question needs ${LIMITS.minOptions}–${LIMITS.maxOptions} options.` }
  }
  if (cleaned.some((o) => !o)) return { error: 'Options cannot be empty.' }
  if (cleaned.some((o) => o.length > LIMITS.option)) return { error: `Each option must be at most ${LIMITS.option} characters.` }
  if (new Set(cleaned.map((o) => o.toLowerCase())).size !== cleaned.length) return { error: 'Options must be different from each other.' }
  return { options: cleaned }
}

function isIndex(value: unknown, length: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < length
}

export function normalizeExerciseInput(raw: unknown, defaults: ExerciseDefaults): NormalizeResult {
  if (typeof raw !== 'object' || raw === null) return { error: 'Question must be an object.' }
  const input = raw as Record<string, unknown>

  const type = input.type
  if (type !== 'selection' && type !== 'multiselect' && type !== 'free-type') {
    return { error: 'type must be one of: selection, multiselect, free-type.' }
  }

  const prompt = text(input.prompt)
  if (!prompt) return { error: 'The question text is required.' }
  if (prompt.length > LIMITS.prompt) return { error: `The question text must be at most ${LIMITS.prompt} characters.` }

  const topic = (text(input.topic) || defaults.topic).slice(0, LIMITS.topic)
  const difficultyRaw = input.difficulty
  const difficulty = (
    typeof difficultyRaw === 'number' && Number.isInteger(difficultyRaw) && difficultyRaw >= 1 && difficultyRaw <= 5
      ? difficultyRaw
      : 2
  ) as ExerciseBase['difficulty']

  const explanation = optionalText(input.explanation, LIMITS.explanation, 'explanation')
  if ('error' in explanation) return explanation
  const hint = optionalText(input.hint, LIMITS.hint, 'hint')
  if ('error' in hint) return hint
  const context = optionalText(input.context, LIMITS.context, 'context')
  if ('error' in context) return context

  const base: ExerciseBase = {
    type,
    topic,
    subtopic: text(input.subtopic).slice(0, LIMITS.topic),
    language: text(input.language) || defaults.language,
    difficulty,
    prompt,
    ...(context.value ? { context: context.value } : {}),
    ...(hint.value ? { hint: hint.value } : {}),
    ...(explanation.value ? { explanation: explanation.value } : {}),
  }

  if (type === 'selection') {
    const opts = options(input.options)
    if ('error' in opts) return opts
    if (!isIndex(input.answer, opts.options.length)) return { error: 'Mark exactly one correct option.' }
    return { exercise: { ...base, type, options: opts.options, answer: input.answer } }
  }

  if (type === 'multiselect') {
    const opts = options(input.options)
    if ('error' in opts) return opts
    const answers = input.answers
    if (!Array.isArray(answers) || answers.length === 0 || !answers.every((a) => isIndex(a, opts.options.length))) {
      return { error: 'Mark at least one correct option.' }
    }
    const unique = [...new Set(answers as number[])].sort((a, b) => a - b)
    return { exercise: { ...base, type, options: opts.options, answers: unique } }
  }

  const answers = Array.isArray(input.answers) ? input.answers.map(text).filter(Boolean) : []
  if (answers.length === 0) return { error: 'Add at least one accepted answer.' }
  if (answers.length > LIMITS.maxFreeAnswers) return { error: `At most ${LIMITS.maxFreeAnswers} accepted answers.` }
  if (answers.some((a) => a.length > LIMITS.freeAnswer)) return { error: `Each answer must be at most ${LIMITS.freeAnswer} characters.` }
  return { exercise: { ...base, type, answers, caseSensitive: input.caseSensitive === true } }
}

/** A URL-safe slug for a user-owned deck; the caller makes it unique with a suffix. */
export function slugifyDeckTitle(title: string): string {
  const slug = Array.from(title)
    // Strip accents from Latin letters only; NFKD on Cyrillic would turn "й" into "и".
    .map((ch) => (/[a-z]/i.test(ch.normalize('NFKD')[0] ?? '') ? ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : ch))
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'deck'
}
