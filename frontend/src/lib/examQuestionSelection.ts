import { toDeckExercise } from './legacyExerciseMapper'
import type { ExamConfig } from '../types/deck'
import type { Exercise } from '../types/exercise'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Picks exercises to fill an exam's facet quotas (see ExamConfig.quotas). Operates on the
 * original bundle-authored Exercise shape throughout — toDeckExercise is used only as a
 * facet-lookup helper for matching, not to convert the exercises themselves, since the
 * rendering layer (getQuestionComponent) expects the original Exercise shape.
 */
export function selectExamQuestions(exercises: Exercise[], deckId: string, examConfig: ExamConfig): Exercise[] {
  const remaining = [...exercises]
  const selected: Exercise[] = []

  for (const quota of examConfig.quotas) {
    const matches = remaining.filter(
      (exercise) => toDeckExercise(exercise, deckId).facets[quota.facetKey] === quota.facetValue
    )
    const picked = shuffle(matches).slice(0, quota.count)
    selected.push(...picked)
    for (const pick of picked) {
      const index = remaining.indexOf(pick)
      if (index >= 0) remaining.splice(index, 1)
    }
  }

  return shuffle(selected).slice(0, examConfig.questionCount)
}
