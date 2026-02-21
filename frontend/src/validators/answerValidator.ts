import type { Exercise, UserAnswer } from '../types/exercise'

export interface ValidationResult {
  correct: boolean
  incorrectIndices?: number[]
  missedIndices?: number[]
}

export function validateAnswer(exercise: Exercise, answer: UserAnswer): ValidationResult {
  switch (exercise.type) {
    case 'selection': {
      if (answer.type !== 'selection') throw new Error('Answer type mismatch')
      return { correct: answer.selectedIndex === exercise.answer }
    }

    case 'multiselect': {
      if (answer.type !== 'multiselect') throw new Error('Answer type mismatch')
      const correctSet = new Set(exercise.answers)
      const selectedSet = new Set(answer.selectedIndices)
      const correct =
        correctSet.size === selectedSet.size && [...correctSet].every((i) => selectedSet.has(i))
      const incorrectIndices = answer.selectedIndices.filter((i) => !correctSet.has(i))
      const missedIndices = exercise.answers.filter((i) => !selectedSet.has(i))
      return { correct, incorrectIndices, missedIndices }
    }

    case 'free-type': {
      if (answer.type !== 'free-type') throw new Error('Answer type mismatch')
      const normalize = (s: string) =>
        exercise.caseSensitive ? s.trim() : s.trim().toLowerCase()
      const correct = exercise.answers.some(
        (accepted) => normalize(accepted) === normalize(answer.text)
      )
      return { correct }
    }

    default: {
      const _exhaustive: never = exercise
      throw new Error(`Unhandled exercise type: ${(_exhaustive as Exercise).type}`)
    }
  }
}
