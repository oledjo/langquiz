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
}

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

export function computeNextReview(
  current: ReviewScheduleState | null,
  grade: AnswerGrade,
  now = new Date()
): NextReviewSchedule {
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
