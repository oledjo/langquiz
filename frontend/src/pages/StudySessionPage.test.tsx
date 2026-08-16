import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { StudySessionPage } from './StudySessionPage'
import * as decksApi from '../api/decksApi'
import * as exercisesApi from '../api/exercisesApi'
import * as progressApi from '../api/progressApi'

const authState = vi.hoisted(() => ({
  current: {
    user: null as { id: number; email: string; role: 'user' | 'admin' } | null,
    isGuest: false,
    isLoading: false,
    token: null as string | null,
    login: vi.fn(),
    register: vi.fn(),
    continueAsGuest: vi.fn(),
    logout: vi.fn(),
  },
}))

// StudySessionPage's untried-only filter depends on useStats, which only fetches when
// there's a logged-in, non-guest user — mocking useAuth lets individual tests opt into that
// without standing up the real AuthProvider's token/fetch machinery.
vi.mock('../auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => authState.current,
}))

const mockDeck = {
  id: '1',
  slug: 'german-grammar-vocabulary',
  title: 'German Grammar & Vocabulary',
  description: '',
  origin: 'official' as const,
  studyModes: ['practice' as const],
  facetDefinitions: [],
  locales: ['en'],
}

const mockExercise = {
  id: 'ex-1',
  type: 'selection' as const,
  topic: 'articles',
  subtopic: 'der',
  language: 'de',
  difficulty: 1 as const,
  prompt: 'Which article is correct for "Hund"?',
  options: ['der', 'die', 'das'],
  answer: 0,
}

function renderAtSlug(slug: string, state?: { topics?: string[] }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/deck/${slug}/study`, state }]}>
      <Routes>
        <Route path="/deck/:slug/study" element={<StudySessionPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StudySessionPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    authState.current = { ...authState.current, user: null, isGuest: false }
  })

  test('shows a loading state, then the question-count picker, then the first question after confirming', async () => {
    const user = userEvent.setup()
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([mockExercise])

    renderAtSlug('german-grammar-vocabulary')

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText(/how many questions/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'All (1)' }))

    await waitFor(() => expect(screen.getByText('Which article is correct for "Hund"?')).toBeInTheDocument())
  })

  test('shows a not-found message when the deck does not exist', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)
    const exercisesSpy = vi.spyOn(exercisesApi, 'fetchExercisesForDeck')

    renderAtSlug('does-not-exist')

    await waitFor(() => expect(screen.getByText(/deck not found/i)).toBeInTheDocument())
    expect(exercisesSpy).not.toHaveBeenCalled()
  })

  test('shows an error message when the deck fetch fails', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockRejectedValue(new Error('GET /api/decks/x failed: 500'))

    renderAtSlug('x')

    await waitFor(() => expect(screen.getByText(/GET \/api\/decks\/x failed: 500/)).toBeInTheDocument())
  })

  test('shows an error message when the exercises fetch fails', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockRejectedValue(new Error('GET /api/exercises?deckId=1 failed: 500'))

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() => expect(screen.getByText(/GET \/api\/exercises\?deckId=1 failed: 500/)).toBeInTheDocument())
  })

  test('shuffles the deck\'s exercises instead of always starting with the first one', async () => {
    const user = userEvent.setup()
    const exercises = ['a', 'b', 'c', 'd'].map((id) => ({ ...mockExercise, id, prompt: `Prompt ${id}` }))
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    // Math.random = 0 makes the shuffle's Fisher-Yates always swap the current index with index
    // 0, a definite, verifiable permutation (see lib/shuffle.test.ts) rather than a no-op.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() => expect(screen.getByText(/how many questions/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'All (4)' }))

    // With Math.random pinned to 0, [a,b,c,d] shuffles to [b,c,d,a] — the session should open
    // on "Prompt b", not the deck's original first exercise "Prompt a".
    await waitFor(() => expect(screen.getByText('Prompt b')).toBeInTheDocument())
    expect(screen.queryByText('Prompt a')).not.toBeInTheDocument()
  })

  test('limits the session to the chosen question count', async () => {
    const user = userEvent.setup()
    const exercises = ['a', 'b', 'c', 'd'].map((id) => ({ ...mockExercise, id, prompt: `Prompt ${id}` }))
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() => expect(screen.getByText(/how many questions/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/custom number/i), '2')
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(screen.getByText('Exercise 1 of 2')).toBeInTheDocument())
  })

  test('links back to the deck', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([mockExercise])

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() => expect(screen.getByRole('link', { name: /german grammar & vocabulary/i })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /german grammar & vocabulary/i })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary'
    )
  })

  test('limits the practice pool to topics selected on the deck detail page', async () => {
    const user = userEvent.setup()
    const exercises = [
      { ...mockExercise, id: 'a', topic: 'articles', prompt: 'Article question' },
      { ...mockExercise, id: 'b', topic: 'verbs', prompt: 'Verb question' },
    ]
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)

    renderAtSlug('german-grammar-vocabulary', { topics: ['verbs'] })

    await waitFor(() => expect(screen.getByText(/how many questions/i)).toBeInTheDocument())
    expect(screen.getByText(/1 available in this deck/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'All (1)' }))

    await waitFor(() => expect(screen.getByText('Verb question')).toBeInTheDocument())
  })

  test('filters to untried questions when the checkbox is checked', async () => {
    const user = userEvent.setup()
    const exercises = ['a', 'b', 'c', 'd'].map((id) => ({ ...mockExercise, id, prompt: `Prompt ${id}` }))
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([
      { exercise_id: 'a', total_attempts: 1, correct_attempts: 1, last_answered: null },
      { exercise_id: 'b', total_attempts: 2, correct_attempts: 0, last_answered: null },
    ])
    authState.current = { ...authState.current, user: { id: 1, email: 'test@example.com', role: 'user' } }

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() =>
      expect(screen.getByText(/only questions i haven't tried yet \(2 available\)/i)).toBeInTheDocument()
    )

    await user.click(screen.getByRole('checkbox'))

    await waitFor(() => expect(screen.getByText('2 available in this deck.')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'All (2)' }))

    await waitFor(() => expect(screen.getByText('Exercise 1 of 2')).toBeInTheDocument())
    expect(screen.queryByText('Prompt a')).not.toBeInTheDocument()
    expect(screen.queryByText('Prompt b')).not.toBeInTheDocument()
  })
})
