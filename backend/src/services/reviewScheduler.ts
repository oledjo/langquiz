import { fsrs, generatorParameters, createEmptyCard, Rating, State, type Card, type Grade } from 'ts-fsrs'

export type AnswerGrade = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewScheduleState {
  repetition_count: number
  interval_days: number
  lapse_count?: number | null
  stability?: string | number | null
  difficulty?: string | number | null
  state?: number | null
  last_reviewed_at?: string | Date | null
  scheduler_version?: string | null
  ease_factor?: string | number | null
}

const ANKI_IMPORT_SCHEDULER_VERSION = 'anki-sm2-import-v1'

export interface NextReviewSchedule {
  repetitionCount: number
  intervalDays: number
  stability: number
  difficulty: number
  state: number
  dueAt: Date
  lapseCount: number
  schedulerVersion: string
}

// FSRS-6, via the reference ts-fsrs implementation (github.com/open-spaced-repetition/ts-fsrs).
// Short-term (same-day, minute-granularity) learning steps are disabled: this app reviews in
// day-granularity practice sessions, not a continuously-polled Anki-style queue, so a card due
// again in "10 minutes" is never actually re-shown until the next session anyway. Disabling
// short-term steps keeps every card in FSRS's day-granularity "Review" state from its first
// answer, which matches how due dates are already surfaced throughout this app.
export const ACTIVE_REVIEW_SCHEDULER_VERSION = 'fsrs-6.0'

const GRADE_TO_RATING: Record<AnswerGrade, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

const scheduler = fsrs(generatorParameters({ enable_short_term: false }))

export function isAnswerGrade(value: unknown): value is AnswerGrade {
  return value === 'again' || value === 'hard' || value === 'good' || value === 'easy'
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function toCard(current: ReviewScheduleState | null, now: Date): Card {
  const stability = toNumber(current?.stability)

  // A missing/zero stability means this exercise has no FSRS memory state yet: either it has
  // never been reviewed, or it's a row left over from the previous (pre-FSRS) scheduler. Either
  // way, FSRS should treat it as a brand-new card rather than trying to reinterpret the old
  // scheduler's ease factor/repetition count as FSRS state.
  if (!current || stability <= 0) {
    return createEmptyCard(now)
  }

  return {
    due: now,
    stability,
    difficulty: toNumber(current.difficulty),
    elapsed_days: 0,
    scheduled_days: current.interval_days,
    learning_steps: 0,
    reps: current.repetition_count,
    lapses: current.lapse_count ?? 0,
    state: (current.state ?? State.Review) as State,
    last_review: current.last_reviewed_at ? new Date(current.last_reviewed_at) : undefined,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * The imported rows are real SM-2 state, not incomplete FSRS state.  Their first answer uses an
 * SM-2 step so reps, lapses, interval and ease survive the hand-off; the resulting row receives
 * a conservative FSRS memory estimate and later answers use the normal FSRS scheduler.
 */
function transitionImportedAnkiCard(current: ReviewScheduleState, grade: AnswerGrade, now: Date): NextReviewSchedule {
  const previousInterval = Math.max(1, current.interval_days)
  let ease = clamp(toNumber(current.ease_factor) || 2.5, 1.3, 3)
  let intervalDays: number
  let lapseCount = current.lapse_count ?? 0

  if (grade === 'again') {
    ease = Math.max(1.3, ease - 0.2)
    lapseCount += 1
    intervalDays = 1
  } else if (grade === 'hard') {
    ease = Math.max(1.3, ease - 0.15)
    intervalDays = Math.max(previousInterval, Math.round(previousInterval * 1.2))
  } else if (grade === 'easy') {
    ease = Math.min(3, ease + 0.15)
    intervalDays = Math.max(previousInterval + 1, Math.round(previousInterval * ease * 1.3))
  } else {
    intervalDays = Math.max(previousInterval + 1, Math.round(previousInterval * ease))
  }

  return {
    repetitionCount: Math.max(0, current.repetition_count) + 1,
    intervalDays,
    // FSRS needs non-zero state after the bridge. These are intentionally conservative seeds,
    // not a claim that Anki's SM-2 factor is an FSRS parameter.
    stability: Math.max(0.1, intervalDays),
    difficulty: clamp(11 - ease * 3, 1, 10),
    state: State.Review,
    dueAt: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000),
    lapseCount,
    schedulerVersion: ACTIVE_REVIEW_SCHEDULER_VERSION,
  }
}

export function computeNextReview(
  current: ReviewScheduleState | null,
  grade: AnswerGrade,
  now = new Date()
): NextReviewSchedule {
  if (current?.scheduler_version === ANKI_IMPORT_SCHEDULER_VERSION) {
    return transitionImportedAnkiCard(current, grade, now)
  }
  const card = toCard(current, now)
  const { card: nextCard } = scheduler.next(card, now, GRADE_TO_RATING[grade])

  return {
    repetitionCount: nextCard.reps,
    intervalDays: nextCard.scheduled_days,
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    state: nextCard.state,
    dueAt: nextCard.due,
    lapseCount: nextCard.lapses,
    schedulerVersion: ACTIVE_REVIEW_SCHEDULER_VERSION,
  }
}
