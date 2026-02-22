export type ExerciseType = 'multiselect' | 'free-type' | 'selection'
export type ExerciseGroup = 'grammar' | 'vocabulary'
export type ExerciseLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export const EXERCISE_LEVELS: ExerciseLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
export const EXERCISE_GROUPS: ExerciseGroup[] = ['grammar', 'vocabulary']

export interface BaseExercise {
  id: string
  type: ExerciseType
  topic: string
  subtopic: string
  language: string
  difficulty: 1 | 2 | 3 | 4 | 5
  level?: ExerciseLevel
  group?: ExerciseGroup
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

function normalizeLevel(value: string | undefined): ExerciseLevel | undefined {
  if (!value) return undefined
  const upper = value.trim().toUpperCase()
  if (EXERCISE_LEVELS.includes(upper as ExerciseLevel)) {
    return upper as ExerciseLevel
  }
  return undefined
}

function inferLevelFromDifficulty(difficulty: BaseExercise['difficulty']): ExerciseLevel {
  if (difficulty <= 2) return 'A1'
  if (difficulty === 3) return 'A2'
  if (difficulty === 4) return 'B1'
  return 'B2'
}

function inferGroupFromExercise(exercise: BaseExercise): ExerciseGroup {
  const topic = exercise.topic.toLowerCase()
  const subtopic = exercise.subtopic.toLowerCase()
  const tags = (exercise.tags ?? []).map((tag) => tag.toLowerCase())
  const text = [topic, subtopic, ...tags].join(' ')
  return text.includes('vocab') || text.includes('word') ? 'vocabulary' : 'grammar'
}

export function normalizeExerciseMetadata<T extends Exercise>(exercise: T): T {
  const normalizedGroup =
    exercise.group && EXERCISE_GROUPS.includes(exercise.group) ? exercise.group : inferGroupFromExercise(exercise)
  const normalizedLevel = normalizeLevel(exercise.level) ?? inferLevelFromDifficulty(exercise.difficulty)

  return {
    ...exercise,
    group: normalizedGroup,
    level: normalizedLevel,
  } as T
}
