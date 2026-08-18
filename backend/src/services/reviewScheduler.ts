export type AnswerGrade = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewScheduleState {
  repetition_count: number
  interval_days: number
  ease_factor: string | number
  lapse_count?: number | null
}

export interface NextReviewSchedule {
  repetitionCount: number
  intervalDays: number
  easeFactor: number
  dueAt: Date
  lapseCount: number
  schedulerVersion: string
}

export interface ReviewSchedulerConfig {
  version: string
  minEaseFactor: number
  maxEaseFactor: number
  initialEaseFactor: number
  gradeEaseDeltas: Record<AnswerGrade, number>
  firstIntervals: Record<Exclude<AnswerGrade, 'again'>, number>
  secondIntervals: Record<Exclude<AnswerGrade, 'again'>, number>
  matureIntervalMultipliers: Record<Exclude<AnswerGrade, 'again'>, number>
  lapseIntervalDays: number
}

export const REVIEW_SCHEDULER_CONFIG: ReviewSchedulerConfig = {
  version: 'sr-v2-2026-05',
  minEaseFactor: 1.3,
  maxEaseFactor: 3.2,
  initialEaseFactor: 2.5,
  gradeEaseDeltas: {
    again: -0.2,
    hard: -0.15,
    good: 0.05,
    easy: 0.1,
  },
  firstIntervals: {
    hard: 1,
    good: 1,
    easy: 2,
  },
  secondIntervals: {
    hard: 2,
    good: 3,
    easy: 5,
  },
  matureIntervalMultipliers: {
    hard: 1.2,
    good: 1,
    easy: 1.3,
  },
  lapseIntervalDays: 1,
}

export const ACTIVE_REVIEW_SCHEDULER_VERSION = REVIEW_SCHEDULER_CONFIG.version

export function isAnswerGrade(value: unknown): value is AnswerGrade {
  return value === 'again' || value === 'hard' || value === 'good' || value === 'easy'
}

function toEaseFactor(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return REVIEW_SCHEDULER_CONFIG.initialEaseFactor
}

function clampEaseFactor(easeFactor: number): number {
  return Math.min(
    REVIEW_SCHEDULER_CONFIG.maxEaseFactor,
    Math.max(REVIEW_SCHEDULER_CONFIG.minEaseFactor, easeFactor)
  )
}

function addDays(now: Date, intervalDays: number): Date {
  return new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)
}

export function computeNextReview(
  current: ReviewScheduleState | null,
  grade: AnswerGrade,
  now = new Date()
): NextReviewSchedule {
  const prevRepetition = current?.repetition_count ?? 0
  const prevInterval = current?.interval_days ?? 0
  const prevEase = toEaseFactor(current?.ease_factor)
  const prevLapseCount = current?.lapse_count ?? 0

  if (grade === 'again') {
    const intervalDays = REVIEW_SCHEDULER_CONFIG.lapseIntervalDays
    return {
      repetitionCount: 0,
      intervalDays,
      easeFactor: clampEaseFactor(prevEase + REVIEW_SCHEDULER_CONFIG.gradeEaseDeltas.again),
      dueAt: addDays(now, intervalDays),
      lapseCount: prevLapseCount + 1,
      schedulerVersion: ACTIVE_REVIEW_SCHEDULER_VERSION,
    }
  }

  const repetitionCount = prevRepetition + 1
  const easeFactor = clampEaseFactor(prevEase + REVIEW_SCHEDULER_CONFIG.gradeEaseDeltas[grade])

  let intervalDays: number
  if (repetitionCount === 1) {
    intervalDays = REVIEW_SCHEDULER_CONFIG.firstIntervals[grade]
  } else if (repetitionCount === 2) {
    intervalDays = REVIEW_SCHEDULER_CONFIG.secondIntervals[grade]
  } else {
    const multiplier = REVIEW_SCHEDULER_CONFIG.matureIntervalMultipliers[grade]
    const base = grade === 'good' ? prevInterval * easeFactor : prevInterval * easeFactor * multiplier
    const floor = grade === 'hard' ? 2 : grade === 'good' ? 4 : 6
    intervalDays = Math.max(floor, Math.round(base))
  }

  return {
    repetitionCount,
    intervalDays,
    easeFactor,
    dueAt: addDays(now, intervalDays),
    lapseCount: prevLapseCount,
    schedulerVersion: ACTIVE_REVIEW_SCHEDULER_VERSION,
  }
}
