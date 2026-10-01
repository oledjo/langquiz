import { db } from '../db/database'
import { isValidFsrsParameters } from './reviewScheduler'

/**
 * Fits FSRS weights to one learner's own answer history with the reference optimizer
 * (fsrs-rs via @open-spaced-repetition/binding), so intervals follow how *they* forget rather
 * than the population defaults.
 */

/** Below this many usable reviews the fit is noise; the defaults are better. */
export const MIN_REVIEWS_FOR_OPTIMIZATION = 400

const RATING: Record<string, number> = { again: 1, hard: 2, good: 3, easy: 4 }
const DAY_MS = 24 * 60 * 60 * 1000

export interface AnswerRow {
  exercise_id: string
  answer_grade: string | null
  correct: boolean
  answered_at: Date | string
}

/** One training example: a question's answers up to and including the one being predicted. */
export type TrainingItem = Array<{ rating: number; deltaT: number }>

/**
 * Answers (grouped by question, oldest first) → FSRS training items. Each question with n answers
 * yields n−1 items: answers 1..k for k = 2..n, as fsrs-rs expects. `deltaT` is whole days since
 * the previous answer (UTC days; 0 for the first answer and for same-day repeats).
 */
export function buildTrainingItems(rows: AnswerRow[]): TrainingItem[] {
  const byExercise = new Map<string, AnswerRow[]>()
  for (const row of rows) {
    const list = byExercise.get(row.exercise_id)
    if (list) list.push(row)
    else byExercise.set(row.exercise_id, [row])
  }

  const items: TrainingItem[] = []
  for (const answers of byExercise.values()) {
    answers.sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime())
    const reviews: TrainingItem = []
    let previousDay: number | null = null
    for (const answer of answers) {
      const day = Math.floor(new Date(answer.answered_at).getTime() / DAY_MS)
      const rating = (answer.answer_grade && RATING[answer.answer_grade]) || (answer.correct ? 3 : 1)
      reviews.push({ rating, deltaT: previousDay === null ? 0 : day - previousDay })
      previousDay = day
      if (reviews.length >= 2) items.push(reviews.slice())
    }
  }
  return items
}

/** Items whose last review came at least a day after the one before: what FSRS can learn from. */
export function countLongTermReviews(items: TrainingItem[]): number {
  return items.filter((item) => item[item.length - 1].deltaT > 0).length
}

export type OptimizeResult =
  | { status: 'optimized'; parameters: number[]; reviewCount: number }
  | { status: 'not_enough_data'; reviewCount: number; required: number }

async function loadAnswers(userId: number): Promise<AnswerRow[]> {
  const result = await db.query<AnswerRow>(
    `SELECT exercise_id, answer_grade, correct, answered_at
     FROM progress
     WHERE user_id = $1 AND COALESCE(mode, 'practice') <> 'exam'
     ORDER BY exercise_id, answered_at`,
    [userId]
  )
  return result.rows
}

export async function optimizeUserParameters(userId: number): Promise<OptimizeResult> {
  const items = buildTrainingItems(await loadAnswers(userId))
  const reviewCount = countLongTermReviews(items)
  if (reviewCount < MIN_REVIEWS_FOR_OPTIMIZATION) {
    return { status: 'not_enough_data', reviewCount, required: MIN_REVIEWS_FOR_OPTIMIZATION }
  }

  // Loaded on demand: a native module, needed only here, must not stop the API from booting.
  const { computeParameters, FSRSBindingItem, FSRSBindingReview } = await import('@open-spaced-repetition/binding')
  const trainSet = items.map(
    (item) => new FSRSBindingItem(item.map((review) => new FSRSBindingReview(review.rating, review.deltaT)))
  )
  const parameters: unknown = await computeParameters(trainSet, { enableShortTerm: false, timeout: 10_000 })
  if (!isValidFsrsParameters(parameters)) {
    throw new Error('FSRS optimizer did not return a valid FSRS-6 parameter set')
  }

  await db.query(
    `INSERT INTO user_fsrs_parameters (user_id, parameters, review_count, computed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       parameters = EXCLUDED.parameters, review_count = EXCLUDED.review_count, computed_at = NOW()`,
    [userId, parameters, reviewCount]
  )
  return { status: 'optimized', parameters, reviewCount }
}

export async function loadSchedulerStatus(userId: number) {
  const [stored, answers] = await Promise.all([
    db.query<{ review_count: number; computed_at: string }>(
      'SELECT review_count, computed_at FROM user_fsrs_parameters WHERE user_id = $1',
      [userId]
    ),
    loadAnswers(userId),
  ])
  const row = stored.rows[0]
  return {
    personalized: Boolean(row),
    computedAt: row?.computed_at ?? null,
    reviewsUsed: row?.review_count ?? null,
    availableReviews: countLongTermReviews(buildTrainingItems(answers)),
    requiredReviews: MIN_REVIEWS_FOR_OPTIMIZATION,
  }
}
