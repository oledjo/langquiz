import { describe, expect, test } from 'vitest'
import { selectExamQuestions } from './examQuestionSelection'
import type { ExamConfig } from '../types/deck'
import type { SelectionExercise } from '../types/exercise'

function makeExercise(overrides: Partial<SelectionExercise>): SelectionExercise {
  return {
    id: 'ex-1',
    type: 'selection',
    topic: 'articles',
    subtopic: 'der',
    language: 'de',
    difficulty: 1,
    prompt: 'p',
    options: ['a', 'b'],
    answer: 0,
    ...overrides,
  }
}

describe('selectExamQuestions', () => {
  test('picks exactly the quota count from each matching group, keyed on the given facet', () => {
    const grammarExercises = Array.from({ length: 5 }, (_, i) =>
      makeExercise({ id: `grammar-${i}`, group: 'grammar' })
    )
    const vocabExercises = Array.from({ length: 5 }, (_, i) =>
      makeExercise({ id: `vocab-${i}`, group: 'vocabulary' })
    )
    const examConfig: ExamConfig = {
      questionCount: 5,
      passingScore: 3,
      quotas: [
        { facetKey: 'group', facetValue: 'grammar', count: 3 },
        { facetKey: 'group', facetValue: 'vocabulary', count: 2 },
      ],
    }

    const result = selectExamQuestions([...grammarExercises, ...vocabExercises], 'deck-1', examConfig)

    expect(result).toHaveLength(5)
    const grammarCount = result.filter((ex) => ex.group === 'grammar').length
    const vocabCount = result.filter((ex) => ex.group === 'vocabulary').length
    expect(grammarCount).toBe(3)
    expect(vocabCount).toBe(2)
  })

  test('takes fewer than the quota when there are not enough matching exercises, without crashing', () => {
    const examConfig: ExamConfig = {
      questionCount: 5,
      passingScore: 3,
      quotas: [{ facetKey: 'group', facetValue: 'grammar', count: 5 }],
    }
    const onlyTwoGrammar = [
      makeExercise({ id: 'g1', group: 'grammar' }),
      makeExercise({ id: 'g2', group: 'grammar' }),
    ]

    const result = selectExamQuestions(onlyTwoGrammar, 'deck-1', examConfig)

    expect(result).toHaveLength(2)
  })

  test('never selects the same exercise twice across overlapping quotas', () => {
    const exercises = Array.from({ length: 4 }, (_, i) => makeExercise({ id: `ex-${i}`, group: 'grammar' }))
    const examConfig: ExamConfig = {
      questionCount: 4,
      passingScore: 2,
      // Two quotas that would both match every exercise if selection didn't remove picks from the pool
      quotas: [
        { facetKey: 'group', facetValue: 'grammar', count: 2 },
        { facetKey: 'topic', facetValue: 'articles', count: 4 },
      ],
    }

    const result = selectExamQuestions(exercises, 'deck-1', examConfig)

    const ids = result.map((ex) => ex.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('returns an empty array when there are no exercises', () => {
    const examConfig: ExamConfig = {
      questionCount: 5,
      passingScore: 3,
      quotas: [{ facetKey: 'group', facetValue: 'grammar', count: 5 }],
    }

    expect(selectExamQuestions([], 'deck-1', examConfig)).toEqual([])
  })
})
