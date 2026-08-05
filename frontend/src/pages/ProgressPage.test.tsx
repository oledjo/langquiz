import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ProgressPage } from './ProgressPage'
import * as decksApi from '../api/decksApi'
import * as progressApi from '../api/progressApi'
import * as exercisesApi from '../api/exercisesApi'
import * as exerciseRegistry from '../registry/exerciseRegistry'

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

const mockDecks = [
  {
    id: '1',
    slug: 'german-grammar-vocabulary',
    title: 'German Grammar & Vocabulary',
    description: '',
    origin: 'official' as const,
    studyModes: ['practice' as const],
    facetDefinitions: [],
    locales: ['en'],
  },
  {
    id: '2',
    slug: 'einbuergerungstest',
    title: 'Einbürgerungstest',
    description: '',
    origin: 'official' as const,
    studyModes: ['practice' as const, 'exam' as const],
    facetDefinitions: [],
    locales: ['en'],
  },
]

const emptyReviewMetrics = {
  totals: { scheduled_total: 0, due_now: 0, overdue: 0, due_next_7_days: 0, total_lapses: 0, last_review_failed: 0 },
  bySchedulerVersion: [],
}

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProgressPage />
    </MemoryRouter>
  )
}

describe('ProgressPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders a tab for "All decks" plus one per deck, with "All decks" selected by default', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(exerciseRegistry, 'getBuiltInExercises').mockReturnValue([])

    renderAtPath('/progress')

    await waitFor(() => expect(screen.getByRole('button', { name: 'All decks' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'German Grammar & Vocabulary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Einbürgerungstest' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All decks' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('selecting a deck calls fetchStats/fetchReviewMetrics with the resolved deckId', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    const statsSpy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    const metricsSpy = vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(exerciseRegistry, 'getBuiltInExercises').mockReturnValue([])

    const user = userEvent.setup()
    renderAtPath('/progress')

    await waitFor(() => expect(screen.getByRole('button', { name: 'German Grammar & Vocabulary' })).toBeInTheDocument())
    await waitFor(() => expect(statsSpy).toHaveBeenCalledWith(undefined))

    await user.click(screen.getByRole('button', { name: 'German Grammar & Vocabulary' }))

    await waitFor(() => expect(statsSpy).toHaveBeenCalledWith('1'))
    expect(metricsSpy).toHaveBeenCalledWith('1')
  })

  test('reads the initial selection from the ?deck= query param', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    const statsSpy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(exerciseRegistry, 'getBuiltInExercises').mockReturnValue([])

    renderAtPath('/progress?deck=einbuergerungstest')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Einbürgerungstest' })).toHaveAttribute('aria-pressed', 'true'))
    await waitFor(() => expect(statsSpy).toHaveBeenCalledWith('2'))
  })
})
