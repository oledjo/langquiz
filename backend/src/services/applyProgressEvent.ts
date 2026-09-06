import {
  computeNextReview,
  type AnswerGrade,
  type ReviewScheduleState,
} from './reviewScheduler'

export interface ProgressDbClient {
  // Deliberately unconstrained R (mirrors how this file called pg's PoolClient.query with
  // interface type args like ReviewScheduleState, which lack an index signature).
  query<R = unknown>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>
}

export interface ProgressEventInput {
  userId: number
  exerciseId: string
  correct: boolean
  grade: AnswerGrade
  mode: 'practice' | 'exam'
  idempotencyKey: string | null
}

export type ProgressEventStatus = 'acked' | 'duplicate' | 'conflict'

/**
 * Insert one progress row (idempotently when a key is supplied) and, outside exam mode,
 * recompute the caller's `user_review_schedule` entry. The caller owns the transaction
 * (BEGIN/COMMIT/ROLLBACK) and turns the returned status into an HTTP response.
 */
export async function applyProgressEvent(
  client: ProgressDbClient,
  input: ProgressEventInput
): Promise<ProgressEventStatus> {
  const { userId, exerciseId, correct, grade, mode, idempotencyKey } = input

  if (idempotencyKey) {
    const insertResult = await client.query<{ id: number }>(
      `INSERT INTO progress (exercise_id, correct, user_id, idempotency_key, answer_grade)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, idempotency_key)
       DO NOTHING
       RETURNING id`,
      [exerciseId, correct, userId, idempotencyKey, grade]
    )

    if ((insertResult.rowCount ?? 0) === 0) {
      const existingResult = await client.query<{
        exercise_id: string
        correct: boolean
        answer_grade: string | null
      }>(
        `SELECT exercise_id, correct, answer_grade
         FROM progress
         WHERE user_id = $1 AND idempotency_key = $2
         ORDER BY id DESC
         LIMIT 1`,
        [userId, idempotencyKey]
      )
      const existing = existingResult.rows[0]
      if (
        existing &&
        (existing.exercise_id !== exerciseId ||
          existing.correct !== correct ||
          (existing.answer_grade ?? null) !== grade)
      ) {
        return 'conflict'
      }
      return 'duplicate'
    }
  } else {
    await client.query(
      'INSERT INTO progress (exercise_id, correct, user_id, answer_grade) VALUES ($1, $2, $3, $4)',
      [exerciseId, correct, userId, grade]
    )
  }

  if (mode !== 'exam') {
    const scheduleResult = await client.query<ReviewScheduleState>(
      `SELECT repetition_count, interval_days, lapse_count, stability, difficulty, state, last_reviewed_at, scheduler_version, ease_factor
       FROM user_review_schedule
       WHERE user_id = $1 AND exercise_id = $2`,
      [userId, exerciseId]
    )
    const nextReview = computeNextReview(scheduleResult.rows[0] ?? null, grade)

    await client.query(
      `INSERT INTO user_review_schedule (
         user_id,
         exercise_id,
         repetition_count,
         interval_days,
         stability,
         difficulty,
         state,
         due_at,
         last_reviewed_at,
         last_outcome_correct,
         scheduler_version,
         lapse_count,
         last_answer_grade,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, NOW())
       ON CONFLICT (user_id, exercise_id)
       DO UPDATE SET
         repetition_count = EXCLUDED.repetition_count,
         interval_days = EXCLUDED.interval_days,
         stability = EXCLUDED.stability,
         difficulty = EXCLUDED.difficulty,
         state = EXCLUDED.state,
         due_at = EXCLUDED.due_at,
         last_reviewed_at = NOW(),
         last_outcome_correct = EXCLUDED.last_outcome_correct,
         scheduler_version = EXCLUDED.scheduler_version,
         lapse_count = EXCLUDED.lapse_count,
         last_answer_grade = EXCLUDED.last_answer_grade,
         updated_at = NOW()`,
      [
        userId,
        exerciseId,
        nextReview.repetitionCount,
        nextReview.intervalDays,
        nextReview.stability,
        nextReview.difficulty,
        nextReview.state,
        nextReview.dueAt,
        correct,
        nextReview.schedulerVersion,
        nextReview.lapseCount,
        grade,
      ]
    )
  }

  return 'acked'
}
