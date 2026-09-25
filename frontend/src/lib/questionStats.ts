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

/** Consecutive correct answers after which a question stops counting as a problem. */
export const MASTERED_STREAK = 3

/**
 * Same rule as the iOS app (QuestionStats.isProblem): a question is a problem if its last answer
 * was wrong, it has 2+ lapses, or it is under 60% over 2+ attempts — unless its last 3 answers
 * were all correct. Falls back to `last_answer_grade` when the backend sends no `recent`.
 */
export function isProblemQuestion(stat: ExerciseStats | undefined): boolean {
  if (!stat) return false
  const recent = stat.recent ?? []
  if (recent.length >= MASTERED_STREAK && recent.slice(-MASTERED_STREAK).every(Boolean)) return false

  const lastWrong = recent.length > 0 ? !recent[recent.length - 1] : stat.last_answer_grade === 'again'
  if (lastWrong) return true
  if ((stat.lapse_count ?? 0) >= 2) return true
  if (stat.total_attempts >= 2 && stat.correct_attempts / stat.total_attempts < 0.6) return true
  return false
}

export function accuracyPercent(stats: QuestionStats): number | null {
  const total = stats.correct + stats.incorrect
  return total > 0 ? Math.round((stats.correct / total) * 100) : null
}
