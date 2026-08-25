import type { Exercise } from '../types/exercise'
import type { ExerciseStats } from '../api/progressApi'

/**
 * Exercises whose most recent answer was wrong. `last_answer_grade` resets to a non-'again' value
 * as soon as the user answers correctly again, so this is "still getting this wrong," not "has
 * ever been gotten wrong" (that would be `lapse_count > 0`, which never goes back down).
 */
export function selectFailedExercises(exercises: Exercise[], statsByExerciseId: Map<string, ExerciseStats>): Exercise[] {
  return exercises.filter((exercise) => statsByExerciseId.get(exercise.id)?.last_answer_grade === 'again')
}
