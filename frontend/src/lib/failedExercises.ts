import type { Exercise } from '../types/exercise'
import type { ExerciseStats } from '../api/progressApi'
import { isProblemQuestion } from './questionStats'

/** Problem questions, by the same rule as the iOS app — see `isProblemQuestion`. */
export function selectFailedExercises(exercises: Exercise[], statsByExerciseId: Map<string, ExerciseStats>): Exercise[] {
  return exercises.filter((exercise) => isProblemQuestion(statsByExerciseId.get(exercise.id)))
}
