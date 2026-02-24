import {
  isValidFreeTypeExercise,
  normalizeExerciseMetadata,
  type Exercise,
} from '../types/exercise'

const exerciseModules = import.meta.glob('../exercises/*.ts', { eager: true }) as Record<
  string,
  { default: Exercise[] }
>

function buildRegistry(): Map<string, Exercise> {
  const registry = new Map<string, Exercise>()

  for (const [path, module] of Object.entries(exerciseModules)) {
    if (!module.default || !Array.isArray(module.default)) {
      console.warn(`Exercise file ${path} does not export a default array. Skipping.`)
      continue
    }
    for (const exercise of module.default) {
      if (exercise.type === 'free-type' && !isValidFreeTypeExercise(exercise)) {
        console.warn(`Skipping invalid free-type exercise "${exercise.id}" in ${path}.`)
        continue
      }
      if (registry.has(exercise.id)) {
        console.error(
          `Duplicate exercise ID "${exercise.id}" in ${path}. Second definition ignored.`
        )
        continue
      }
      registry.set(exercise.id, normalizeExerciseMetadata(exercise))
    }
  }

  return registry
}

export const exerciseRegistry = buildRegistry()

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function slugifyTopic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
}

function buildAutoExerciseId(topic: string, type: string, index: number): string {
  const topicSlug = slugifyTopic(topic) || 'topic'
  const typeSlug = slugifyTopic(type) || 'exercise'
  return `custom-${topicSlug}-${typeSlug}-${Date.now()}-${index + 1}`
}

function normalizeStringValue(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function createExerciseFingerprint(exercise: Exercise): string {
  const normalized = normalizeExerciseMetadata(exercise)
  const baseParts = [
    normalizeStringValue(normalized.type),
    normalizeStringValue(normalized.topic),
    normalizeStringValue(normalized.subtopic),
    normalizeStringValue(normalized.language),
    String(normalized.difficulty),
    normalizeStringValue(normalized.level),
    normalizeStringValue(normalized.group),
    normalizeStringValue(normalized.prompt),
    normalizeStringValue(normalized.context),
  ]

  if (normalized.type === 'selection') {
    return JSON.stringify({
      baseParts,
      options: normalized.options.map((opt) => normalizeStringValue(opt)),
      answer: normalized.answer,
    })
  }

  if (normalized.type === 'multiselect') {
    return JSON.stringify({
      baseParts,
      options: normalized.options.map((opt) => normalizeStringValue(opt)),
      answers: [...normalized.answers].sort((a, b) => a - b),
    })
  }

  return JSON.stringify({
    baseParts,
    answers: normalized.answers.map((ans) => normalizeStringValue(ans)).sort(),
    caseSensitive: !!normalized.caseSensitive,
  })
}

function parseExercise(input: unknown, index: number): { exercise?: Exercise; error?: string } {
  if (!input || typeof input !== 'object') {
    return { error: `Exercise #${index + 1} is not an object.` }
  }
  const exercise = input as Record<string, unknown>

  const requiredStringFields = ['type', 'topic', 'subtopic', 'language', 'prompt'] as const
  for (const field of requiredStringFields) {
    if (typeof exercise[field] !== 'string' || !exercise[field]) {
      return { error: `Exercise #${index + 1} missing valid "${field}".` }
    }
  }

  if (typeof exercise.difficulty !== 'number' || exercise.difficulty < 1 || exercise.difficulty > 5) {
    return { error: `Exercise #${index + 1} has invalid "difficulty" (must be 1..5).` }
  }
  if (exercise.level !== undefined) {
    if (typeof exercise.level !== 'string' || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(exercise.level)) {
      return { error: `Exercise #${index + 1} has invalid "level" (must be A1..C2).` }
    }
  }
  if (exercise.group !== undefined) {
    if (exercise.group !== 'grammar' && exercise.group !== 'vocabulary') {
      return { error: `Exercise #${index + 1} has invalid "group" (must be "grammar" or "vocabulary").` }
    }
  }

  if (exercise.context !== undefined && typeof exercise.context !== 'string') {
    return { error: `Exercise #${index + 1} has invalid "context".` }
  }
  if (exercise.hint !== undefined && typeof exercise.hint !== 'string') {
    return { error: `Exercise #${index + 1} has invalid "hint".` }
  }
  if (exercise.explanation !== undefined && typeof exercise.explanation !== 'string') {
    return { error: `Exercise #${index + 1} has invalid "explanation".` }
  }
  if (exercise.tags !== undefined && !isStringArray(exercise.tags)) {
    return { error: `Exercise #${index + 1} has invalid "tags".` }
  }

  if (exercise.type === 'selection') {
    const options = exercise.options
    const answer = exercise.answer
    if (!isStringArray(options) || typeof answer !== 'number') {
      return { error: `Selection exercise #${index + 1} must include "options" and numeric "answer".` }
    }
    if (answer < 0 || answer >= options.length) {
      return { error: `Selection exercise #${index + 1} has out-of-range "answer".` }
    }
    return { exercise: normalizeExerciseMetadata(exercise as unknown as Exercise) }
  }

  if (exercise.type === 'multiselect') {
    const options = exercise.options
    const answers = exercise.answers
    if (!isStringArray(options) || !isNumberArray(answers)) {
      return {
        error: `Multiselect exercise #${index + 1} must include "options" and numeric array "answers".`,
      }
    }
    if (answers.some((a) => a < 0 || a >= options.length)) {
      return { error: `Multiselect exercise #${index + 1} has out-of-range values in "answers".` }
    }
    return { exercise: normalizeExerciseMetadata(exercise as unknown as Exercise) }
  }

  if (exercise.type === 'free-type') {
    if (!isStringArray(exercise.answers)) {
      return { error: `Free-type exercise #${index + 1} must include string array "answers".` }
    }
    if (exercise.caseSensitive !== undefined && typeof exercise.caseSensitive !== 'boolean') {
      return { error: `Free-type exercise #${index + 1} has invalid "caseSensitive".` }
    }
    const normalizedExercise = normalizeExerciseMetadata(exercise as unknown as Exercise)
    if (!isValidFreeTypeExercise(normalizedExercise as Extract<Exercise, { type: 'free-type' }>)) {
      return {
        error:
          `Free-type exercise #${index + 1} must have one-word answers, optionally with an article (e.g. "Haus" or "das Haus").`,
      }
    }
    return { exercise: normalizedExercise }
  }

  return { error: `Exercise #${index + 1} has unsupported "type".` }
}

function extractExerciseArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const maybe = (payload as Record<string, unknown>).exercises
    if (Array.isArray(maybe)) return maybe
  }
  return null
}

function extractJsonCandidate(rawText: string): string | null {
  const trimmed = rawText.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()

  const objectStart = trimmed.indexOf('{')
  const objectEnd = trimmed.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1).trim()
  }

  const arrayStart = trimmed.indexOf('[')
  const arrayEnd = trimmed.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1).trim()
  }

  return null
}

function normalizeJsonLikeText(text: string): string {
  return text
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/\u00A0/g, ' ')
    .trim()
}

export interface CustomImportResult {
  added: number
  skipped: number
  errors: string[]
}

/**
 * Parses and validates a JSON text input into an array of exercises ready to upload.
 * Returns validated exercises plus any parse/validation errors.
 * Does NOT perform duplicate checking (caller handles that with existing exercises).
 */
export function parseExercisesFromJson(
  jsonText: string,
  existingExercises: Exercise[]
): { toAdd: Exercise[]; skipped: number; errors: string[] } {
  const candidate = extractJsonCandidate(jsonText)
  if (!candidate) {
    return { toAdd: [], skipped: 0, errors: ['No JSON payload found in the input.'] }
  }

  const normalizedCandidate = normalizeJsonLikeText(candidate)
  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(normalizedCandidate)
  } catch {
    return {
      toAdd: [],
      skipped: 0,
      errors: [
        'Invalid JSON format. Use valid JSON (double quotes) or paste an LLM response containing a JSON object/array.',
      ],
    }
  }

  const parsedArray = extractExerciseArray(parsedPayload)
  if (!parsedArray) {
    return {
      toAdd: [],
      skipped: 0,
      errors: ['JSON must be an array of exercises or an object with "exercises" array.'],
    }
  }

  const existing = new Map<string, Exercise>()
  const existingFingerprints = new Set<string>()
  for (const exercise of exerciseRegistry.values()) {
    existing.set(exercise.id, exercise)
    existingFingerprints.add(createExerciseFingerprint(exercise))
  }
  for (const exercise of existingExercises) {
    existing.set(exercise.id, exercise)
    existingFingerprints.add(createExerciseFingerprint(exercise))
  }

  const toAdd: Exercise[] = []
  const errors: string[] = []
  let skipped = 0

  parsedArray.forEach((raw, index) => {
    const { exercise, error } = parseExercise(raw, index)
    if (error) {
      errors.push(error)
      skipped += 1
      return
    }
    if (!exercise) {
      skipped += 1
      return
    }

    const fingerprint = createExerciseFingerprint(exercise)
    if (existingFingerprints.has(fingerprint)) {
      errors.push(`Exercise #${index + 1} is a duplicate and was skipped.`)
      skipped += 1
      return
    }

    let generatedId = buildAutoExerciseId(exercise.topic, exercise.type, index)
    let suffix = 1
    while (existing.has(generatedId)) {
      generatedId = `${buildAutoExerciseId(exercise.topic, exercise.type, index)}-${suffix}`
      suffix += 1
    }

    const exerciseWithAutoId = normalizeExerciseMetadata({ ...exercise, id: generatedId } as Exercise)
    existing.set(exerciseWithAutoId.id, exerciseWithAutoId)
    existingFingerprints.add(fingerprint)
    toAdd.push(exerciseWithAutoId)
  })

  return { toAdd, skipped, errors }
}

export function getBuiltInExercises(): Exercise[] {
  return Array.from(exerciseRegistry.values())
}

export function getExerciseById(id: string): Exercise | undefined {
  return exerciseRegistry.get(id)
}

export function getExercisesFiltered(
  allExercises: Exercise[],
  opts: {
    language?: string
    topic?: string
    subtopic?: string
    difficulty?: number
    level?: string
    group?: string
    tags?: string[]
  }
): Exercise[] {
  return allExercises.filter((e) => {
    if (opts.language && e.language !== opts.language) return false
    if (opts.topic && e.topic !== opts.topic) return false
    if (opts.subtopic && e.subtopic !== opts.subtopic) return false
    if (opts.difficulty && e.difficulty !== opts.difficulty) return false
    if (opts.level && e.level !== opts.level) return false
    if (opts.group && e.group !== opts.group) return false
    if (opts.tags && opts.tags.length > 0) {
      const exerciseTags = e.tags ?? []
      if (!opts.tags.some((tag) => exerciseTags.includes(tag))) return false
    }
    return true
  })
}

export function getAvailableTopics(allExercises: Exercise[], language?: string): string[] {
  const exercises = language
    ? allExercises.filter((exercise) => exercise.language === language)
    : allExercises
  return [...new Set(exercises.map((exercise) => exercise.topic))].sort()
}
