import type { Exercise } from '../types/exercise'
import type { ExerciseStats } from '../api/progressApi'

/** Exercises whose spaced-repetition due date has arrived, oldest due first. */
export function selectDueExercises(
  exercises: Exercise[],
  statsByExerciseId: Map<string, ExerciseStats>,
  nowMs: number
): Exercise[] {
  return exercises
    .filter((exercise) => {
      const dueAt = statsByExerciseId.get(exercise.id)?.due_at
      if (!dueAt) return false
      const dueAtMs = Date.parse(dueAt)
      return Number.isFinite(dueAtMs) && dueAtMs <= nowMs
    })
    .sort((a, b) => {
      const aDue = Date.parse(statsByExerciseId.get(a.id)?.due_at ?? '')
      const bDue = Date.parse(statsByExerciseId.get(b.id)?.due_at ?? '')
      return aDue - bDue
    })
}

/** At most `remaining` items; `null` (limits unknown, e.g. guest or fetch failed) means no cap. */
export function capToDailyLimit<T>(items: T[], remaining: number | null | undefined): T[] {
  if (remaining === null || remaining === undefined) return items
  return items.slice(0, Math.max(0, remaining))
}
