import { describe, expect, test } from 'vitest'
import type { Exercise, FreeTypeExercise, MultiSelectExercise, SelectionExercise } from '../types/exercise'
import { toDeckExercise } from './legacyExerciseMapper'

const baseLegacy: SelectionExercise = {
  id: 'de-grammar-articles-der-001',
  type: 'selection',
  topic: 'grammar',
  subtopic: 'articles',
  language: 'de',
  difficulty: 1,
  level: 'A1',
  group: 'grammar',
  prompt: 'Which article is correct for "Hund" (dog)?',
  context: '___ Hund ist groß.',
  options: ['der', 'die', 'das', 'den'],
  answer: 0,
  explanation: '"Hund" is masculine in German, so it uses "der" in the nominative case.',
  grammarNote: 'Masculine nouns take "der" in the nominative case.',
  tags: ['articles', 'nominative', 'masculine'],
}

describe('toDeckExercise', () => {
  test('maps topic/subtopic/language/level/group into facets', () => {
    const result = toDeckExercise(baseLegacy, 'deck-de-grammar')

    expect(result.facets).toEqual({
      topic: 'grammar',
      subtopic: 'articles',
      language: 'de',
      level: 'A1',
      group: 'grammar',
    })
  })

  test('maps grammarNote to reference', () => {
    const result = toDeckExercise(baseLegacy, 'deck-de-grammar')

    expect(result.reference).toBe('Masculine nouns take "der" in the nominative case.')
  })

  test('carries deckId, id, difficulty, prompt, context, explanation, tags unchanged', () => {
    const result = toDeckExercise(baseLegacy, 'deck-de-grammar')

    expect(result.deckId).toBe('deck-de-grammar')
    expect(result.id).toBe('de-grammar-articles-der-001')
    expect(result.difficulty).toBe(1)
    expect(result.prompt).toBe(baseLegacy.prompt)
    expect(result.context).toBe(baseLegacy.context)
    expect(result.explanation).toBe(baseLegacy.explanation)
    expect(result.tags).toEqual(baseLegacy.tags)
  })

  test('omits level and group facets when the legacy exercise has neither', () => {
    const legacy: Exercise = {
      ...baseLegacy,
      level: undefined,
      group: undefined,
    }

    const result = toDeckExercise(legacy, 'deck-de-grammar')

    expect(result.facets.level).toBeUndefined()
    expect(result.facets.group).toBeUndefined()
    expect(result.facets.topic).toBe('grammar')
  })

  test('selection exercises keep options and answer', () => {
    const result = toDeckExercise(baseLegacy, 'deck-de-grammar')

    expect(result.type).toBe('selection')
    if (result.type === 'selection') {
      expect(result.options).toEqual(baseLegacy.options)
      expect(result.answer).toBe(baseLegacy.answer)
    }
  })

  test('multiselect exercises keep options and answers', () => {
    const legacy: MultiSelectExercise = {
      id: 'de-vocab-colors-001',
      type: 'multiselect',
      topic: 'vocabulary',
      subtopic: 'colors',
      language: 'de',
      difficulty: 1,
      prompt: 'Which of these are colors in German?',
      options: ['rot', 'Hund', 'blau', 'Katze'],
      answers: [0, 2],
      tags: ['colors'],
    }

    const result = toDeckExercise(legacy, 'deck-de-vocab')

    expect(result.type).toBe('multiselect')
    if (result.type === 'multiselect') {
      expect(result.options).toEqual(legacy.options)
      expect(result.answers).toEqual(legacy.answers)
    }
  })

  test('free-type exercises keep answers and caseSensitive', () => {
    const legacy: FreeTypeExercise = {
      id: 'de-grammar-plural-001',
      type: 'free-type',
      topic: 'grammar',
      subtopic: 'plurals',
      language: 'de',
      difficulty: 2,
      prompt: 'What is the plural of "Hund"?',
      answers: ['Hunde'],
      caseSensitive: true,
      tags: ['plurals'],
    }

    const result = toDeckExercise(legacy, 'deck-de-grammar')

    expect(result.type).toBe('free-type')
    if (result.type === 'free-type') {
      expect(result.answers).toEqual(legacy.answers)
      expect(result.caseSensitive).toBe(true)
    }
  })

  test('merges a legacy exercise\'s facets into the derived facets', () => {
    const legacy: Exercise = {
      ...baseLegacy,
      facets: { scope: 'general' },
    }

    const result = toDeckExercise(legacy, 'deck-einbuergerungstest')

    expect(result.facets).toEqual({
      topic: 'grammar',
      subtopic: 'articles',
      language: 'de',
      level: 'A1',
      group: 'grammar',
      scope: 'general',
    })
  })
})
