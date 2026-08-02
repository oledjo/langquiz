import { describe, expect, test } from 'vitest'
import { mapDeckRow, type DeckRow } from './deckMapper'

const baseRow: DeckRow = {
  id: 1,
  slug: 'german-grammar-vocabulary',
  title: 'German Grammar & Vocabulary',
  description: 'Practice German grammar and vocabulary.',
  origin: 'official',
  owner_id: null,
  study_modes: ['practice'],
  facet_definitions: [{ key: 'level', label: 'CEFR level', values: ['A1', 'A2'] }],
  locales: ['en'],
  exam_config: null,
  answer_rule_id: null,
}

describe('mapDeckRow', () => {
  test('serializes numeric id as a string', () => {
    const result = mapDeckRow(baseRow)
    expect(result.id).toBe('1')
  })

  test('maps snake_case columns to camelCase fields', () => {
    const result = mapDeckRow(baseRow)
    expect(result.studyModes).toEqual(['practice'])
    expect(result.facetDefinitions).toEqual(baseRow.facet_definitions)
  })

  test('omits ownerId when owner_id is null', () => {
    const result = mapDeckRow(baseRow)
    expect(result.ownerId).toBeUndefined()
  })

  test('serializes a non-null owner_id as a string', () => {
    const result = mapDeckRow({ ...baseRow, owner_id: 42 })
    expect(result.ownerId).toBe('42')
  })

  test('omits examConfig when exam_config is null', () => {
    const result = mapDeckRow(baseRow)
    expect(result.examConfig).toBeUndefined()
  })

  test('maps a non-null exam_config through unchanged', () => {
    const examConfig = { questionCount: 33, passingScore: 17, quotas: [] }
    const result = mapDeckRow({ ...baseRow, exam_config: examConfig })
    expect(result.examConfig).toEqual(examConfig)
  })

  test('omits answerRuleId when answer_rule_id is null', () => {
    const result = mapDeckRow(baseRow)
    expect(result.answerRuleId).toBeUndefined()
  })
})
