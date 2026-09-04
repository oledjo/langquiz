import { describe, expect, test } from 'vitest'
import { ACTIVE_REVIEW_SCHEDULER_VERSION, computeNextReview, isAnswerGrade } from './reviewScheduler'

describe('isAnswerGrade', () => {
  test('accepts the four FSRS ratings', () => {
    expect(isAnswerGrade('again')).toBe(true)
    expect(isAnswerGrade('hard')).toBe(true)
    expect(isAnswerGrade('good')).toBe(true)
    expect(isAnswerGrade('easy')).toBe(true)
  })

  test('rejects anything else', () => {
    expect(isAnswerGrade('perfect')).toBe(false)
    expect(isAnswerGrade(undefined)).toBe(false)
    expect(isAnswerGrade(null)).toBe(false)
  })
})

describe('computeNextReview', () => {
  const now = new Date('2026-01-01T00:00:00Z')

  test('schedules a brand-new card (no prior state)', () => {
    const next = computeNextReview(null, 'good', now)

    expect(next.repetitionCount).toBe(1)
    expect(next.lapseCount).toBe(0)
    expect(next.state).toBe(2) // Review
    expect(next.intervalDays).toBeGreaterThan(0)
    expect(next.stability).toBeGreaterThan(0)
    expect(next.dueAt.getTime()).toBeGreaterThan(now.getTime())
    expect(next.schedulerVersion).toBe(ACTIVE_REVIEW_SCHEDULER_VERSION)
  })

  test('easy grants a longer interval than good, which is longer than hard', () => {
    const hard = computeNextReview(null, 'hard', now)
    const good = computeNextReview(null, 'good', now)
    const easy = computeNextReview(null, 'easy', now)

    expect(hard.intervalDays).toBeLessThanOrEqual(good.intervalDays)
    expect(good.intervalDays).toBeLessThan(easy.intervalDays)
  })

  test('again on a brand-new card does not count as a lapse yet', () => {
    const next = computeNextReview(null, 'again', now)
    expect(next.lapseCount).toBe(0)
    expect(next.repetitionCount).toBe(1)
  })

  test('again on a previously-reviewed card increments lapses and shortens the interval', () => {
    const first = computeNextReview(null, 'good', now)
    const current = {
      repetition_count: first.repetitionCount,
      interval_days: first.intervalDays,
      lapse_count: first.lapseCount,
      stability: first.stability,
      difficulty: first.difficulty,
      state: first.state,
      last_reviewed_at: now,
    }

    const relapsed = computeNextReview(current, 'again', first.dueAt)

    expect(relapsed.lapseCount).toBe(1)
    expect(relapsed.repetitionCount).toBe(2)
    expect(relapsed.stability).toBeLessThan(first.stability)
    expect(relapsed.intervalDays).toBeLessThan(first.intervalDays)
  })

  test('a legacy row with no FSRS state (zero stability) is treated as a fresh card', () => {
    const legacyRow = {
      repetition_count: 7,
      interval_days: 42,
      lapse_count: 2,
      stability: 0,
      difficulty: 0,
      state: null,
      last_reviewed_at: null,
    }

    const fresh = computeNextReview(null, 'good', now)
    const fromLegacy = computeNextReview(legacyRow, 'good', now)

    expect(fromLegacy.repetitionCount).toBe(fresh.repetitionCount)
    expect(fromLegacy.stability).toBe(fresh.stability)
    expect(fromLegacy.intervalDays).toBe(fresh.intervalDays)
  })

  test('transitions an imported Anki SM-2 card without resetting its review history', () => {
    const imported = {
      repetition_count: 7,
      interval_days: 42,
      lapse_count: 2,
      stability: 0,
      difficulty: 0,
      state: 2,
      last_reviewed_at: null,
      scheduler_version: 'anki-sm2-import-v1',
      ease_factor: 2.5,
    }

    const next = computeNextReview(imported, 'good', now)

    expect(next.repetitionCount).toBe(8)
    expect(next.lapseCount).toBe(2)
    expect(next.intervalDays).toBeGreaterThan(42)
    expect(next.schedulerVersion).toBe(ACTIVE_REVIEW_SCHEDULER_VERSION)
  })

  test('reviewing again after answering correctly builds a longer interval than the first review', () => {
    let current = null as Parameters<typeof computeNextReview>[0]
    let reviewTime = now

    const first = computeNextReview(current, 'good', reviewTime)
    current = {
      repetition_count: first.repetitionCount,
      interval_days: first.intervalDays,
      lapse_count: first.lapseCount,
      stability: first.stability,
      difficulty: first.difficulty,
      state: first.state,
      last_reviewed_at: reviewTime,
    }
    reviewTime = first.dueAt

    const second = computeNextReview(current, 'good', reviewTime)

    expect(second.intervalDays).toBeGreaterThan(first.intervalDays)
    expect(second.repetitionCount).toBe(2)
  })
})
