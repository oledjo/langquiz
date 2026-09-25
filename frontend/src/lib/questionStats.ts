import type { ExerciseStats } from '../api/progressApi'

export const RECENT_RESULTS_LIMIT = 10

export interface QuestionStats {
  correct: number
  incorrect: number
  /** Most recent answers, oldest first, at most RECENT_RESULTS_LIMIT. */
  recent: boolean[]
}

/**
 * A question's history as shown right after answering it. The answer on screen isn't saved until
 * the learner picks a grade, so it is appended here rather than waiting for the server.
 * Guests (no stats) see only the current answer.
 */
export function questionStatsWithAnswer(stat: ExerciseStats | undefined, justAnsweredCorrect: boolean): QuestionStats {
  const correct = (stat?.correct_attempts ?? 0) + (justAnsweredCorrect ? 1 : 0)
  const total = (stat?.total_attempts ?? 0) + 1
  const recent = [...(stat?.recent ?? []), justAnsweredCorrect].slice(-RECENT_RESULTS_LIMIT)
  return { correct, incorrect: Math.max(0, total - correct), recent }
}

export function accuracyPercent(stats: QuestionStats): number | null {
  const total = stats.correct + stats.incorrect
  return total > 0 ? Math.round((stats.correct / total) * 100) : null
}
