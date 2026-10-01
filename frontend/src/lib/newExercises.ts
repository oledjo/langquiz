import type { Exercise } from '../types/exercise'
import type { ExerciseStats } from '../api/progressApi'
import type { Deck } from '../types/deck'

/**
 * Never-answered questions of a deck in authored order, skipping topics the learner stopped
 * learning, capped at `limit`. Empty when the whole deck is paused.
 */
export function selectNewExercises(
  deck: Deck,
  exercises: Exercise[],
  statsByExerciseId: Map<string, ExerciseStats>,
  limit: number
): Exercise[] {
  if (deck.learningPaused || limit <= 0) return []
  const pausedTopics = new Set(deck.pausedTopics ?? [])
  return exercises
    .filter((exercise) => !statsByExerciseId.has(exercise.id) && !pausedTopics.has(exercise.topic))
    .slice(0, limit)
}
