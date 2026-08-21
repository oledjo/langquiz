import { describe, expect, test } from 'vitest'
import {
  mergeQuestionImages,
  normalizeContentType,
  parseImageSlot,
  questionImageUrl,
  type StoredQuestionImage,
} from './questionImages'

const UPDATED_AT = new Date('2026-08-21T12:00:00Z')

/** The shape of a question payload as it comes out of the exercises route, loosely typed. */
interface QuestionPayload extends Record<string, unknown> {
  id: string
  options: string[]
  media?: { kind: string; url: string | null; alt: string; attribution?: string }
  optionImages?: { kind: string; url: string | null; alt: string }[]
}

function stored(overrides: Partial<StoredQuestionImage> = {}): StoredQuestionImage {
  return {
    exercise_id: 'ebt-21',
    option_index: null,
    alt: 'Der Bundesadler',
    attribution: null,
    updated_at: UPDATED_AT,
    ...overrides,
  }
}

describe('parseImageSlot', () => {
  test('accepts the question slot and single-digit option indexes', () => {
    expect(parseImageSlot('question')).toEqual({ kind: 'question' })
    expect(parseImageSlot('0')).toEqual({ kind: 'option', index: 0 })
    expect(parseImageSlot('9')).toEqual({ kind: 'option', index: 9 })
  })

  test('rejects anything else', () => {
    expect(parseImageSlot('10')).toBeNull()
    expect(parseImageSlot('-1')).toBeNull()
    expect(parseImageSlot('media')).toBeNull()
    expect(parseImageSlot('')).toBeNull()
  })
})

describe('normalizeContentType', () => {
  test('accepts the renderable image types, with parameters stripped', () => {
    expect(normalizeContentType('image/png')).toBe('image/png')
    expect(normalizeContentType('image/svg+xml; charset=utf-8')).toBe('image/svg+xml')
    expect(normalizeContentType('IMAGE/JPEG')).toBe('image/jpeg')
  })

  test('rejects everything else, including missing types', () => {
    expect(normalizeContentType('application/pdf')).toBeNull()
    expect(normalizeContentType('text/html')).toBeNull()
    expect(normalizeContentType(undefined)).toBeNull()
  })
})

describe('questionImageUrl', () => {
  test('points at the public route and carries a version marker', () => {
    expect(questionImageUrl(stored())).toBe(
      `/api/question-images/ebt-21/question?v=${Math.floor(UPDATED_AT.getTime() / 1000)}`
    )
    expect(questionImageUrl(stored({ option_index: 2 }))).toContain('/api/question-images/ebt-21/2?v=')
  })
})

describe('mergeQuestionImages', () => {
  const question: QuestionPayload = {
    id: 'ebt-21',
    options: ['Bild 1', 'Bild 2'],
    media: { kind: 'image', url: null, alt: 'old' },
  }

  test('leaves payloads untouched when nothing is uploaded', () => {
    const payloads = [question]
    expect(mergeQuestionImages(payloads, [])).toBe(payloads)
  })

  test('an upload replaces the description placeholder the import left behind', () => {
    const [merged] = mergeQuestionImages([question], [stored({ alt: 'Bundesadler', attribution: 'BAMF' })])

    expect(merged.media).toEqual({
      kind: 'image',
      url: expect.stringContaining('/api/question-images/ebt-21/question'),
      alt: 'Bundesadler',
      attribution: 'BAMF',
    })
    // The stored row is never mutated in place.
    expect(question.media?.alt).toBe('old')
  })

  test('an option upload fills only its own slot, leaving the others as empty placeholders', () => {
    const [merged] = mergeQuestionImages([question], [stored({ option_index: 1, alt: 'Christusmonogramm' })])

    expect(merged.optionImages).toHaveLength(2)
    expect(merged.optionImages?.[0]).toEqual({ kind: 'image', url: null, alt: '' })
    expect(merged.optionImages?.[1]).toMatchObject({ alt: 'Christusmonogramm' })
  })

  test('keeps the descriptions already on the question for the options that have no upload', () => {
    const withDescriptions: QuestionPayload = {
      id: 'ebt-21',
      options: ['Bild 1', 'Bild 2'],
      optionImages: [
        { kind: 'image', url: null, alt: 'Ein schwarzer Adler.' },
        { kind: 'image', url: null, alt: 'Zwei griechische Buchstaben.' },
      ],
    }

    const [merged] = mergeQuestionImages([withDescriptions], [stored({ option_index: 0, alt: 'Bundesadler' })])

    expect(merged.optionImages?.[0]).toMatchObject({ alt: 'Bundesadler' })
    expect(merged.optionImages?.[1]).toEqual({ kind: 'image', url: null, alt: 'Zwei griechische Buchstaben.' })
  })

  test('ignores an upload for an option the question does not have', () => {
    const [merged] = mergeQuestionImages([question], [stored({ option_index: 5 })])

    expect(merged.optionImages).toBeUndefined()
  })

  test('only touches the question the upload belongs to', () => {
    const other: QuestionPayload = { id: 'ebt-99', options: ['a', 'b'] }

    const merged = mergeQuestionImages([question, other], [stored()])

    expect(merged[1]).toBe(other)
  })
})
