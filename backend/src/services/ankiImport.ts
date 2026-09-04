import crypto from 'crypto'

export type SupportedAnkiModel =
  | 'Basic'
  | 'Basic (and reversed card)'
  | 'Basic (type in the answer)'
  | 'DE-RU (4 fields)'
  | 'Goethe Vocab List'

export interface AnkiField {
  value: string
  order: number
}

export interface AnkiNote {
  noteId: string | number
  modelName: string
  fields: Record<string, AnkiField>
}

export interface AnkiCard {
  cardId: string | number
  note: string | number
  modelName: string
  deckName: string
  ord: number
  type: number
  interval: number
  reps: number
  lapses: number
  factor: number
  due: number | string | Date
  queue: number
}

export interface Exercise {
  id: string
  type: 'free-type'
  topic: string
  subtopic: string
  language: string
  difficulty: 1 | 2 | 3 | 4 | 5
  group: 'vocabulary'
  prompt: string
  answers: string[]
  isUserAdded: true
  shareStatus: 'private'
}

export interface AnkiSource {
  ankiCardId: string
  ankiNoteId: string
  deck: string
  model: SupportedAnkiModel
}

export interface ImportCandidate {
  status: 'ready'
  exercise: Exercise
  source: AnkiSource
}

export interface NeedsReviewCandidate {
  status: 'needs_review'
  reason: string
}

export type ImportResult = ImportCandidate | NeedsReviewCandidate

export interface ImportedSchedule {
  repetitionCount: number
  intervalDays: number
  lapseCount: number
  easeFactor: number
  state: 0 | 1 | 2 | 3
  dueAt: Date
  lastReviewedAt: Date | null
  sourceScheduler: 'anki-sm2'
  schedulerVersion: 'anki-sm2-import-v1'
}

export type ScheduleResult = ImportedSchedule | NeedsReviewCandidate

const SUPPORTED_MODELS = new Set<SupportedAnkiModel>([
  'Basic',
  'Basic (and reversed card)',
  'Basic (type in the answer)',
  'DE-RU (4 fields)',
  'Goethe Vocab List',
])

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => {
      const normalized = entity.toLowerCase()
      if (normalized.startsWith('#x')) return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16))
      if (normalized.startsWith('#')) return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10))
      return ENTITY_MAP[normalized] ?? `&${entity};`
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function isEmbeddedOnlyMedia(value: string, text: string): boolean {
  return !text && /<(img|audio|video)\b|\[sound:[^\]]+\]/i.test(value)
}

function fieldByName(fields: Record<string, AnkiField>, names: string[]): AnkiField | undefined {
  const wanted = new Set(names.map((name) => name.toLocaleLowerCase()))
  return Object.entries(fields).find(([name]) => wanted.has(name.toLocaleLowerCase()))?.[1]
}

function modelFields(note: AnkiNote): { front: AnkiField; back: AnkiField } | NeedsReviewCandidate {
  const names = (() => {
    switch (note.modelName) {
      case 'Basic':
      case 'Basic (and reversed card)':
        return { front: 'Front', back: 'Back' }
      case 'DE-RU (4 fields)':
        return { front: 'German', back: 'Russian' }
      case 'Goethe Vocab List':
        return { front: 'de_word', back: 'en_word' }
      default:
        return null
    }
  })()
  if (!names) return { status: 'needs_review', reason: 'Ambiguous model fields' }

  const front = fieldByName(note.fields, [names.front])
  const back = fieldByName(note.fields, [names.back])
  return front && back ? { front, back } : { status: 'needs_review', reason: 'Ambiguous model fields' }
}

function reverseCard(model: SupportedAnkiModel, ordinal: number): boolean | null {
  if (model === 'Basic (and reversed card)' || model === 'Goethe Vocab List') {
    return ordinal === 0 ? false : ordinal === 1 ? true : null
  }
  if (model === 'DE-RU (4 fields)') return ordinal === 0 ? false : null
  return ordinal === 0 ? false : null
}

export function toImportCandidate(note: AnkiNote, card: AnkiCard): ImportResult {
  if (card.queue < 0) return { status: 'needs_review', reason: 'Suspended or buried Anki card' }

  if (!SUPPORTED_MODELS.has(note.modelName as SupportedAnkiModel)) {
    return { status: 'needs_review', reason: `Unsupported Anki model: ${note.modelName}` }
  }

  const model = note.modelName as SupportedAnkiModel
  if (model === 'Basic (type in the answer)') {
    return { status: 'needs_review', reason: `Model requires verified template metadata: ${model}` }
  }
  const fields = modelFields(note)
  if ('status' in fields) return fields

  const front = stripHtml(fields.front.value)
  const back = stripHtml(fields.back.value)
  if (!front || !back) {
    if (isEmbeddedOnlyMedia(fields.front.value, front) || isEmbeddedOnlyMedia(fields.back.value, back)) {
      return { status: 'needs_review', reason: 'Embedded-only media is not supported' }
    }
    return { status: 'needs_review', reason: 'Empty Front or Back field' }
  }

  const reverse = reverseCard(model, card.ord)
  if (reverse === null) return { status: 'needs_review', reason: 'Ambiguous card direction' }

  return {
    status: 'ready',
    exercise: {
      id: `anki-${card.cardId}`,
      type: 'free-type',
      topic: 'Anki import',
      subtopic: card.deckName,
      language: 'de',
      difficulty: 3,
      group: 'vocabulary',
      prompt: reverse ? back : front,
      answers: [reverse ? front : back],
      isUserAdded: true,
      shareStatus: 'private',
    },
    source: {
      ankiCardId: String(card.cardId),
      ankiNoteId: String(note.noteId),
      deck: card.deckName,
      model,
    },
  }
}

function finiteInteger(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : 0
}

/** Maps Anki's new/learning/review/relearning type values to the same 0–3 FSRS state values. */
function stateFor(cardType: number): 0 | 1 | 2 | 3 {
  return cardType === 1 || cardType === 2 || cardType === 3 ? cardType : 0
}

export function toSchedule(card: AnkiCard, now: Date, collectionCreatedAt?: Date): ScheduleResult {
  if (card.queue < 0) return { status: 'needs_review', reason: 'Suspended or buried Anki card' }

  const state = stateFor(finiteInteger(card.type))
  let dueAt: Date
  if (state === 0) {
    // Anki's new-card due value is queue order, not a timestamp.
    dueAt = new Date(now.getTime())
  } else if (state === 2) {
    if (!collectionCreatedAt) {
      return { status: 'needs_review', reason: 'Review due date requires collection creation timestamp' }
    }
    const anchor = collectionCreatedAt.getTime()
    if (!Number.isFinite(anchor) || !Number.isFinite(Number(card.due))) {
      return { status: 'needs_review', reason: 'Invalid review due index' }
    }
    // Review due is a collection-day index, so its absolute value requires this explicit anchor.
    dueAt = new Date(anchor + finiteInteger(card.due) * 24 * 60 * 60 * 1000)
  } else {
    // Learning and relearning due values are Unix seconds in Anki's card payload.
    const seconds = Number(card.due)
    dueAt = new Date(seconds * 1000)
    if (!Number.isFinite(seconds) || Number.isNaN(dueAt.getTime())) {
      return { status: 'needs_review', reason: 'Invalid learning due timestamp' }
    }
  }

  return {
    repetitionCount: Math.max(0, finiteInteger(card.reps)),
    intervalDays: Math.max(0, finiteInteger(card.interval)),
    lapseCount: Math.max(0, finiteInteger(card.lapses)),
    easeFactor: Math.max(0, finiteInteger(card.factor)) / 1000,
    state,
    dueAt,
    lastReviewedAt: null,
    sourceScheduler: 'anki-sm2',
    schedulerVersion: 'anki-sm2-import-v1',
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function hash(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value), 'utf8').digest('hex')
}

export function contentHash(exercise: Exercise): string {
  return hash(exercise)
}

export function scheduleHash(schedule: ImportedSchedule): string {
  return hash({ ...schedule, dueAt: schedule.dueAt.toISOString() })
}
