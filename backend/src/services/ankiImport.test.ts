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
  const collectionNow = new Date('2026-09-05T10:00:00.000Z')

  test('maps an Anki review card without inventing history', () => {
    expect(toSchedule(forwardCard, collectionNow)).toMatchObject({
      repetitionCount: 12,
      intervalDays: 21,
      lapseCount: 2,
      easeFactor: 2.45,
      state: 2,
      dueAt: new Date('2026-09-09T10:00:00.000Z'),
      schedulerVersion: 'anki-sm2-import-v1',
    })
  })

  test('maps Anki card types directly to the existing FSRS states', () => {
    expect(toSchedule({ ...forwardCard, type: 0 }, collectionNow).state).toBe(0)
    expect(toSchedule({ ...forwardCard, type: 1 }, collectionNow).state).toBe(1)
    expect(toSchedule({ ...forwardCard, type: 3 }, collectionNow).state).toBe(3)
  })
})

describe('hashes', () => {
  test('are deterministic over normalized content and schedule values', () => {
    const candidate = toImportCandidate(basicNote, forwardCard)
    if (candidate.status !== 'ready') throw new Error('fixture must be importable')

    expect(contentHash(candidate.exercise)).toBe(contentHash({ ...candidate.exercise }))
    expect(scheduleHash(toSchedule(forwardCard, new Date('2026-09-05T10:00:00.000Z')))).toBe(
      scheduleHash(toSchedule({ ...forwardCard }, new Date('2026-09-05T10:00:00.000Z')))
    )
  })
})
