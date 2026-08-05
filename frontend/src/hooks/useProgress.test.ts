import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useReviewMetrics, useStats } from './useProgress'
import * as progressApi from '../api/progressApi'

vi.mock('../auth/AuthContext', () => {
  const user = { id: 1, email: 'test@example.com', role: 'user' as const }
  const authValue = {
    user,
    isGuest: false,
    isLoading: false,
    token: 'test-token',
    login: vi.fn(),
    register: vi.fn(),
    continueAsGuest: vi.fn(),
    logout: vi.fn(),
  }
  return {
    useAuth: () => authValue,
  }
})

describe('useStats', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('fetches unscoped stats when no deckId is given', async () => {
    const spy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    renderHook(() => useStats())

    await waitFor(() => expect(spy).toHaveBeenCalledWith(undefined))
  })

  test('fetches deck-scoped stats and re-fetches when deckId changes', async () => {
    const spy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    const { rerender } = renderHook(({ deckId }) => useStats(deckId), { initialProps: { deckId: '1' } })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1'))

    await act(async () => {
      rerender({ deckId: '2' })
    })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('2'))

    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('useReviewMetrics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('fetches unscoped review metrics when no deckId is given', async () => {
    const spy = vi
      .spyOn(progressApi, 'fetchReviewMetrics')
      .mockResolvedValue({ totals: { scheduled_total: 0, due_now: 0, overdue: 0, due_next_7_days: 0, total_lapses: 0, last_review_failed: 0 }, bySchedulerVersion: [] })

    renderHook(() => useReviewMetrics())

    await waitFor(() => expect(spy).toHaveBeenCalledWith(undefined))
  })

  test('fetches deck-scoped review metrics and re-fetches when deckId changes', async () => {
    const spy = vi
      .spyOn(progressApi, 'fetchReviewMetrics')
      .mockResolvedValue({ totals: { scheduled_total: 0, due_now: 0, overdue: 0, due_next_7_days: 0, total_lapses: 0, last_review_failed: 0 }, bySchedulerVersion: [] })

    const { rerender } = renderHook(({ deckId }) => useReviewMetrics(deckId), { initialProps: { deckId: '1' } })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1'))

    await act(async () => {
      rerender({ deckId: '2' })
    })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('2'))

    expect(spy).toHaveBeenCalledTimes(2)
  })
})
