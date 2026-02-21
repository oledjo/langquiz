import type { Exercise } from '../types/exercise'

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
      if (registry.has(exercise.id)) {
        console.error(
          `Duplicate exercise ID "${exercise.id}" in ${path}. Second definition ignored.`
        )
        continue
      }
      registry.set(exercise.id, exercise)
    }
  }

  return registry
}

export const exerciseRegistry = buildRegistry()
const CUSTOM_EXERCISES_STORAGE_KEY = 'langquiz.custom-exercises.v1'

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readCustomExercisesFromStorage(): Exercise[] {
  if (!canUseLocalStorage()) return []
  const raw = window.localStorage.getItem(CUSTOM_EXERCISES_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Exercise[]
  } catch {
    return []
  }
}

function writeCustomExercisesToStorage(exercises: Exercise[]): void {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(CUSTOM_EXERCISES_STORAGE_KEY, JSON.stringify(exercises))
}

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
    return { exercise: exercise as unknown as Exercise }
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
    return { exercise: exercise as unknown as Exercise }
  }

  if (exercise.type === 'free-type') {
    if (!isStringArray(exercise.answers)) {
      return { error: `Free-type exercise #${index + 1} must include string array "answers".` }
    }
    if (exercise.caseSensitive !== undefined && typeof exercise.caseSensitive !== 'boolean') {
      return { error: `Free-type exercise #${index + 1} has invalid "caseSensitive".` }
    }
    return { exercise: exercise as unknown as Exercise }
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

  // Direct JSON payload
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed

  // Markdown fenced block: ```json ... ```
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()

  // Best-effort object extraction
  const objectStart = trimmed.indexOf('{')
  const objectEnd = trimmed.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1).trim()
  }

  // Best-effort array extraction
  const arrayStart = trimmed.indexOf('[')
  const arrayEnd = trimmed.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1).trim()
  }

  return null
}

function normalizeJsonLikeText(text: string): string {
  return text
    .replace(/[\u201C\u201D\u2033]/g, '"') // curly/double-prime double quotes
    .replace(/[\u2018\u2019\u2032]/g, "'") // curly/single-prime single quotes
    .replace(/\u00A0/g, ' ') // non-breaking spaces
    .trim()
}

export interface CustomImportResult {
  added: number
  skipped: number
  errors: string[]
}

export function getCustomExercises(): Exercise[] {
  return readCustomExercisesFromStorage()
}

export function clearCustomExercises(): void {
  writeCustomExercisesToStorage([])
}

export function removeCustomExercisesByTopic(topic: string): number {
  const current = readCustomExercisesFromStorage()
  const filtered = current.filter((exercise) => exercise.topic !== topic)
  writeCustomExercisesToStorage(filtered)
  return current.length - filtered.length
}

export function getCustomTopicCounts(): Record<string, number> {
  return readCustomExercisesFromStorage().reduce<Record<string, number>>((acc, exercise) => {
    acc[exercise.topic] = (acc[exercise.topic] ?? 0) + 1
    return acc
  }, {})
}

export function importCustomExercises(jsonText: string): CustomImportResult {
  let parsedPayload: unknown
  const candidate = extractJsonCandidate(jsonText)
  if (!candidate) {
    return { added: 0, skipped: 0, errors: ['No JSON payload found in the input.'] }
  }

  const normalizedCandidate = normalizeJsonLikeText(candidate)
  try {
    parsedPayload = JSON.parse(normalizedCandidate)
  } catch {
    return {
      added: 0,
      skipped: 0,
      errors: [
        'Invalid JSON format. Use valid JSON (double quotes) or paste an LLM response containing a JSON object/array.',
      ],
    }
  }

  const parsedArray = extractExerciseArray(parsedPayload)
  if (!parsedArray) {
    return {
      added: 0,
      skipped: 0,
      errors: ['JSON must be an array of exercises or an object with "exercises" array.'],
    }
  }

  const existing = new Map<string, Exercise>()
  for (const exercise of exerciseRegistry.values()) existing.set(exercise.id, exercise)
  for (const exercise of readCustomExercisesFromStorage()) existing.set(exercise.id, exercise)

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

    let generatedId = buildAutoExerciseId(exercise.topic, exercise.type, index)
    let suffix = 1
    while (existing.has(generatedId)) {
      generatedId = `${buildAutoExerciseId(exercise.topic, exercise.type, index)}-${suffix}`
      suffix += 1
    }

    const exerciseWithAutoId = { ...exercise, id: generatedId } as Exercise
    existing.set(exerciseWithAutoId.id, exerciseWithAutoId)
    toAdd.push(exerciseWithAutoId)
  })

  if (toAdd.length > 0) {
    writeCustomExercisesToStorage([...readCustomExercisesFromStorage(), ...toAdd])
  }

  return { added: toAdd.length, skipped, errors }
}

export function getAllExercises(): Exercise[] {
  return [...Array.from(exerciseRegistry.values()), ...readCustomExercisesFromStorage()]
}

export function getExerciseById(id: string): Exercise | undefined {
  return exerciseRegistry.get(id) ?? readCustomExercisesFromStorage().find((exercise) => exercise.id === id)
}

export function getExercisesFiltered(opts: {
  language?: string
  topic?: string
  subtopic?: string
  difficulty?: number
  tags?: string[]
}): Exercise[] {
  return getAllExercises().filter((e) => {
    if (opts.language && e.language !== opts.language) return false
    if (opts.topic && e.topic !== opts.topic) return false
    if (opts.subtopic && e.subtopic !== opts.subtopic) return false
    if (opts.difficulty && e.difficulty !== opts.difficulty) return false
    if (opts.tags && opts.tags.length > 0) {
      const exerciseTags = e.tags ?? []
      if (!opts.tags.some((tag) => exerciseTags.includes(tag))) return false
    }
    return true
  })
}

export function getAvailableTopics(language?: string): string[] {
  const exercises = language ? getAllExercises().filter((e) => e.language === language) : getAllExercises()
  return [...new Set(exercises.map((e) => e.topic))].sort()
}
