import type { Exercise } from '../types/exercise'
import type { ExerciseStats } from '../api/progressApi'

/** Exercises that have never been attempted (no exercise_stats row for them). */
export function selectUntriedExercises(exercises: Exercise[], statsByExerciseId: Map<string, ExerciseStats>): Exercise[] {
  return exercises.filter((exercise) => !statsByExerciseId.has(exercise.id))
}
