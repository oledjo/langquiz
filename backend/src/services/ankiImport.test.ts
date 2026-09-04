import { describe, expect, test } from 'vitest'
import {
  contentHash,
  scheduleHash,
  toImportCandidate,
  toSchedule,
  type AnkiCard,
  type AnkiNote,
} from './ankiImport'

const basicNote: AnkiNote = {
  noteId: 456,
  modelName: 'Basic',
  fields: {
    Front: { value: '<b>house</b>&nbsp;', order: 0 },
    Back: { value: ' Haus ', order: 1 },
  },
}

const forwardCard: AnkiCard = {
  cardId: 123,
  note: 456,
  modelName: 'Basic',
  deckName: 'German::1. Words',
  ord: 0,
  type: 2,
  interval: 21,
  reps: 12,
  lapses: 2,
  factor: 2450,
  due: 4,
  queue: 2,
}

describe('toImportCandidate', () => {
  test('converts a Basic forward card into a normalized free-type exercise', () => {
    expect(toImportCandidate(basicNote, forwardCard)).toMatchObject({
      status: 'ready',
      exercise: {
        id: 'anki-123',
        type: 'free-type',
        prompt: 'house',
        answers: ['Haus'],
      },
      source: {
        ankiCardId: '123',
        ankiNoteId: '456',
        deck: 'German::1. Words',
        model: 'Basic',
      },
    })
  })

  test('preserves the reverse direction for a reversed Basic card', () => {
    const reversed: AnkiCard = { ...forwardCard, cardId: 124, ord: 1 }

    expect(toImportCandidate({ ...basicNote, modelName: 'Basic (and reversed card)' }, reversed)).toMatchObject({
      exercise: { prompt: 'Haus', answers: ['house'] },
    })
  })

  test('sends an unsupported model to review instead of guessing its fields', () => {
    const unknownNote: AnkiNote = { ...basicNote, modelName: 'Cloze' }

    expect(toImportCandidate(unknownNote, forwardCard)).toEqual({
      status: 'needs_review',
      reason: 'Unsupported Anki model: Cloze',
    })
  })

  test('sends models without verified template metadata to review', () => {
    expect(toImportCandidate({ ...basicNote, modelName: 'DE-RU (4 fields)' }, forwardCard)).toEqual({
      status: 'needs_review',
      reason: 'Model requires verified template metadata: DE-RU (4 fields)',
    })
  })

  test('sends suspended and buried cards to review instead of importing them as active', () => {
    expect(toImportCandidate(basicNote, { ...forwardCard, queue: -1 })).toEqual({
      status: 'needs_review',
      reason: 'Suspended or buried Anki card',
    })
    expect(toImportCandidate(basicNote, { ...forwardCard, queue: -2 })).toEqual({
      status: 'needs_review',
      reason: 'Suspended or buried Anki card',
    })
  })

  test('sends empty and media-only fields to review', () => {
    expect(toImportCandidate({ ...basicNote, fields: { Front: { value: '', order: 0 }, Back: { value: 'Haus', order: 1 } } }, forwardCard)).toEqual({
      status: 'needs_review',
      reason: 'Empty Front or Back field',
    })
    expect(toImportCandidate({ ...basicNote, fields: { Front: { value: '<img src="house.png">', order: 0 }, Back: { value: 'Haus', order: 1 } } }, forwardCard)).toEqual({
      status: 'needs_review',
      reason: 'Embedded-only media is not supported',
    })
  })
})

describe('toSchedule', () => {
  const now = new Date('2026-09-05T10:00:00.000Z')
  const collectionCreatedAt = new Date('2026-09-01T00:00:00.000Z')

  test('maps a review card only when given its collection creation timestamp', () => {
    expect(toSchedule(forwardCard, now, collectionCreatedAt)).toMatchObject({
      repetitionCount: 12,
      intervalDays: 21,
      lapseCount: 2,
      easeFactor: 2.45,
      state: 2,
      dueAt: new Date('2026-09-05T00:00:00.000Z'),
      lastReviewedAt: null,
      schedulerVersion: 'anki-sm2-import-v1',
    })
  })

  test('requires an anchor instead of guessing a review due date', () => {
    expect(toSchedule(forwardCard, now)).toEqual({
      status: 'needs_review',
      reason: 'Review due date requires collection creation timestamp',
    })
  })

  test('maps a new card queue position to availability now', () => {
    expect(toSchedule({ ...forwardCard, type: 0, queue: 0, due: 999 }, now)).toMatchObject({
      state: 0,
      dueAt: now,
    })
  })

  test('preserves learning and relearning Unix-second due moments', () => {
    const dueAt = new Date('2026-09-05T12:00:00.000Z')
    expect(toSchedule({ ...forwardCard, type: 1, queue: 1, due: 1788609600 }, now)).toMatchObject({
      state: 1,
      dueAt,
    })
    expect(toSchedule({ ...forwardCard, type: 3, queue: 3, due: 1788609600 }, now)).toMatchObject({
      state: 3,
      dueAt,
    })
  })

  test('sends suspended and buried schedules to review', () => {
    expect(toSchedule({ ...forwardCard, queue: -1 }, now, collectionCreatedAt)).toEqual({
      status: 'needs_review',
      reason: 'Suspended or buried Anki card',
    })
  })
})

describe('hashes', () => {
  test('are deterministic over normalized content and schedule values', () => {
    const candidate = toImportCandidate(basicNote, forwardCard)
    if (candidate.status !== 'ready') throw new Error('fixture must be importable')

    expect(contentHash(candidate.exercise)).toBe(contentHash({ ...candidate.exercise }))
    const collectionCreatedAt = new Date('2026-09-01T00:00:00.000Z')
    const firstSchedule = toSchedule(forwardCard, new Date('2026-09-05T10:00:00.000Z'), collectionCreatedAt)
    const secondSchedule = toSchedule({ ...forwardCard }, new Date('2026-09-05T10:00:00.000Z'), collectionCreatedAt)
    if ('status' in firstSchedule || 'status' in secondSchedule) {
      throw new Error('fixture must produce an imported schedule')
    }
    expect(scheduleHash(firstSchedule)).toBe(
      scheduleHash(secondSchedule)
    )
  })
})
