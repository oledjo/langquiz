import type { AnyDeckExercise, DeckExercise, Exercise } from '../types/exercise'

/**
 * Converts a bundle-authored `Exercise` (the shape used by the 43 files in
 * `src/exercises/`) into the deck-aware `AnyDeckExercise` shape. Used by a
 * future seed migration to load this content into Postgres as a deck.
 */
export function toDeckExercise(legacy: Exercise, deckId: string): AnyDeckExercise {
  const facets: Record<string, string> = {
    topic: legacy.topic,
    subtopic: legacy.subtopic,
    language: legacy.language,
  }
  if (legacy.level) facets.level = legacy.level
  if (legacy.group) facets.group = legacy.group
  if (legacy.facets) Object.assign(facets, legacy.facets)

  const shared: Omit<DeckExercise, 'type'> = {
    id: legacy.id,
    deckId,
    difficulty: legacy.difficulty,
    prompt: legacy.prompt,
    context: legacy.context,
    hint: legacy.hint,
    reference: legacy.grammarNote,
    explanation: legacy.explanation,
    facets,
    tags: legacy.tags,
    isUserAdded: legacy.isUserAdded,
    shareStatus: legacy.shareStatus,
    voteCount: legacy.voteCount,
  }

  switch (legacy.type) {
    case 'selection':
      return { ...shared, type: 'selection', options: legacy.options, answer: legacy.answer }
    case 'multiselect':
      return { ...shared, type: 'multiselect', options: legacy.options, answers: legacy.answers }
    case 'free-type':
      return {
        ...shared,
        type: 'free-type',
        answers: legacy.answers,
        caseSensitive: legacy.caseSensitive,
      }
    default: {
      const exhaustive: never = legacy
      throw new Error(`Unhandled exercise type: ${(exhaustive as Exercise).type}`)
    }
  }
}
