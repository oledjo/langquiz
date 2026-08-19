import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ProgressDashboard } from './ProgressDashboard'
import * as progressApi from '../api/progressApi'
import type { ExerciseStats } from '../api/progressApi'
import type { Exercise } from '../types/exercise'

vi.mock('../auth/AuthContext', () => {
  const user = { id: 1, email: 'test@example.com', role: 'user' as const }
  return {
    useAuth: () => ({ user, isGuest: false, isLoading: false }),
  }
})

const emptyReviewMetrics = {
  totals: { scheduled_total: 0, due_now: 0, overdue: 0, due_next_7_days: 0, total_lapses: 0, last_review_failed: 0 },
  bySchedulerVersion: [],
}

function exercise(id: string, topic: string): Exercise {
  return {
    id,
    type: 'free-type',
    topic,
    subtopic: 'sub',
    language: 'de',
    difficulty: 1,
    prompt: `Prompt ${id}`,
    answers: ['x'],
  }
}

function statRow(exerciseId: string, correct: number, total: number): ExerciseStats {
  return { exercise_id: exerciseId, total_attempts: total, correct_attempts: correct, last_answered: null }
}

describe('ProgressDashboard weak topics visibility', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('hides weak topics when no deck is selected ("All decks"), even with multiple topics', async () => {
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([statRow('a', 2, 5), statRow('b', 4, 5)])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)

    render(<ProgressDashboard exercises={[exercise('a', 'Grammar'), exercise('b', 'Vocabulary')]} deckId={undefined} />)

    await waitFor(() => expect(screen.getByText('Your progress')).toBeInTheDocument())
    expect(screen.queryByText('Weak topics')).not.toBeInTheDocument()
  })

  test('hides weak topics within a deck when only one topic has data', async () => {
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([statRow('a', 2, 5)])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)

    render(<ProgressDashboard exercises={[exercise('a', 'Grammar')]} deckId="1" />)

    await waitFor(() => expect(screen.getByText('Your progress')).toBeInTheDocument())
    expect(screen.queryByText('Weak topics')).not.toBeInTheDocument()
  })

  test('shows weak topics within a deck once at least two topics have data', async () => {
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([statRow('a', 2, 5), statRow('b', 4, 5)])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)

    render(<ProgressDashboard exercises={[exercise('a', 'Grammar'), exercise('b', 'Vocabulary')]} deckId="1" />)

    await waitFor(() => expect(screen.getByText('Weak topics')).toBeInTheDocument())
    expect(screen.getByText('Grammar')).toBeInTheDocument()
    expect(screen.getByText('Vocabulary')).toBeInTheDocument()
  })
})
