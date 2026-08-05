import type { Exercise } from '../types/exercise'

/**
 * Keeps an exercise only if it has no deckId (not yet deck-scoped) or its deckId matches
 * `allowedDeckId`. Passing `undefined` for `allowedDeckId` keeps everything unfiltered — used
 * by the legacy Home screen before the grammar deck's id has resolved.
 */
export function filterExercisesByDeck(exercises: Exercise[], allowedDeckId: string | undefined): Exercise[] {
  if (!allowedDeckId) return exercises
  return exercises.filter((exercise) => !exercise.deckId || exercise.deckId === allowedDeckId)
}
