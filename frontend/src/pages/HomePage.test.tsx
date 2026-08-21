import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { HomePage } from './HomePage'
import * as decksApi from '../api/decksApi'
import * as progressApi from '../api/progressApi'
import * as exercisesApi from '../api/exercisesApi'
import * as userExercisesApi from '../api/userExercisesApi'

const authState = vi.hoisted(() => ({
  current: {
    user: { id: 1, email: 'test@example.com', role: 'user' as const } as { id: number; email: string; role: 'user' | 'admin' } | null,
    isGuest: false,
    isLoading: false,
    token: 'token' as string | null,
    login: vi.fn(),
    register: vi.fn(),
    continueAsGuest: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState.current,
}))

const mockDecks = [
  {
    id: '1',
    slug: 'german-grammar-vocabulary',
    title: 'German Grammar & Vocabulary',
    description: 'Practice German grammar and vocabulary.',
    origin: 'official' as const,
    studyModes: ['practice' as const],
    facetDefinitions: [],
    locales: ['en'],
  },
]

const emptyReviewMetrics = {
  totals: { scheduled_total: 0, due_now: 0, overdue: 0, due_next_7_days: 0, total_lapses: 0, last_review_failed: 0 },
  bySchedulerVersion: [],
}

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  )
}

describe('HomePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    authState.current = { ...authState.current, isGuest: false, user: { id: 1, email: 'test@example.com', role: 'user' } }
  })

  test('shows a loading state, then the fetched decks', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(userExercisesApi, 'fetchUserExercises').mockResolvedValue([])

    renderHome()

    expect(screen.getByText(/loading decks/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /German Grammar & Vocabulary/ })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary'
    )
  })

  test('shows an empty state when there are no decks', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(userExercisesApi, 'fetchUserExercises').mockResolvedValue([])

    renderHome()

    await waitFor(() => expect(screen.getByText(/no decks/i)).toBeInTheDocument())
  })

  test('shows a due-reviews prompt with a link to /review when reviews are due', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([
      {
        exercise_id: 'ex-1',
        total_attempts: 3,
        correct_attempts: 2,
        last_answered: null,
        due_at: new Date(Date.now() - 60_000).toISOString(),
      },
    ])
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([
      {
        id: 'ex-1',
        type: 'selection',
        topic: 'articles',
        subtopic: 'der',
        language: 'de',
        difficulty: 1,
        prompt: 'p',
        options: ['a', 'b'],
        answer: 0,
      },
    ])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(userExercisesApi, 'fetchUserExercises').mockResolvedValue([])

    renderHome()

    await waitFor(() => expect(screen.getByText('1 due')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Review due now' })).toHaveAttribute('href', '/review')
  })

  test('does not show the due-reviews prompt when nothing is due', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(userExercisesApi, 'fetchUserExercises').mockResolvedValue([])

    renderHome()

    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Review due now' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Review due' })).not.toBeInTheDocument()
  })

  test('shows a per-deck due badge and review link when a deck has reviews due', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue({
      totals: { scheduled_total: 5, due_now: 3, overdue: 1, due_next_7_days: 2, total_lapses: 0, last_review_failed: 0 },
      bySchedulerVersion: [],
    })
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(userExercisesApi, 'fetchUserExercises').mockResolvedValue([])

    renderHome()

    await waitFor(() => expect(screen.getByText('3 due')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Review due' })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary/review'
    )
  })

  test('hides the import entry point and due-reviews prompt for guests, but still shows the deck grid', async () => {
    authState.current = { ...authState.current, isGuest: true, user: null }
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    const allExercisesSpy = vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])

    renderHome()

    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Import your own exercises/ })).not.toBeInTheDocument()
    expect(screen.getByText(/guest mode covers the official decks/i)).toBeInTheDocument()
    // The cross-deck due-review list is the only consumer of this call and is hidden for guests.
    expect(allExercisesSpy).not.toHaveBeenCalled()
  })
})
