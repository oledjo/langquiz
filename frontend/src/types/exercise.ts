export type ExerciseType = 'multiselect' | 'free-type' | 'selection'

export interface BaseExercise {
  id: string
  type: ExerciseType
  topic: string
  subtopic: string
  language: string
  difficulty: 1 | 2 | 3 | 4 | 5
  prompt: string
  context?: string
  hint?: string
  explanation?: string
  tags?: string[]
}

export interface MultiSelectExercise extends BaseExercise {
  type: 'multiselect'
  options: string[]
  answers: number[]
}

export interface FreeTypeExercise extends BaseExercise {
  type: 'free-type'
  answers: string[]
  caseSensitive?: boolean
}

export interface SelectionExercise extends BaseExercise {
  type: 'selection'
  options: string[]
  answer: number
}

export type Exercise = MultiSelectExercise | FreeTypeExercise | SelectionExercise

export type UserAnswer =
  | { type: 'multiselect'; selectedIndices: number[] }
  | { type: 'free-type'; text: string }
  | { type: 'selection'; selectedIndex: number }
