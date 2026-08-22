import type { ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ReviewSessionPage } from './ReviewSessionPage'
import * as exercisesApi from '../api/exercisesApi'
import * as progressApi from '../api/progressApi'

const authState = vi.hoisted(() => ({
  current: {
    user: { id: 1, email: 'test@example.com', role: 'user' as const } as {
      id: number
      email: string
      role: 'user' | 'admin'
    } | null,
    isGuest: false,
    isLoading: false,
    token: 'test-token' as string | null,
    login: vi.fn(),
    register: vi.fn(),
    continueAsGuest: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('../auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => authState.current,
}))

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

function renderReviewPage() {
  return render(
    <MemoryRouter initialEntries={['/review']}>
      <Routes>
        <Route path="/review" element={<ReviewSessionPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ReviewSessionPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Answering a due question reschedules it, so the refreshed stats no longer report it as due.
  // The running session has to keep the list it started with: before this was fixed, the page
  // re-derived an empty due list mid-session and swapped the session out for its empty state.
  test('keeps the session running after its only due question is answered', async () => {
    const user = userEvent.setup()
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([mockExercise])
    vi.spyOn(progressApi, 'postResult').mockResolvedValue(undefined)
    const statsSpy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([
      {
        exercise_id: 'ex-1',
        total_attempts: 1,
        correct_attempts: 1,
        last_answered: null,
        due_at: new Date(Date.now() - 60_000).toISOString(),
      },
    ])

    renderReviewPage()

    await waitFor(() => expect(screen.getByText('Which article is correct for "Hund"?')).toBeInTheDocument())

    statsSpy.mockResolvedValue([
      {
        exercise_id: 'ex-1',
        total_attempts: 2,
        correct_attempts: 2,
        last_answered: null,
        due_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ])
    const statsCallsBeforeAnswer = statsSpy.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'der' }))
    await user.click(screen.getByRole('button', { name: /check answer/i }))
    await user.click(screen.getByRole('button', { name: 'Good' }))

    await waitFor(() => expect(statsSpy.mock.calls.length).toBeGreaterThan(statsCallsBeforeAnswer))
    await act(async () => {})

    expect(screen.getByText(/due reviews complete/i)).toBeInTheDocument()
    expect(screen.queryByText(/no reviews are due right now/i)).not.toBeInTheDocument()
  })

  test('shows the empty state when nothing is due', async () => {
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([mockExercise])
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    renderReviewPage()

    await waitFor(() => expect(screen.getByText(/no reviews are due right now/i)).toBeInTheDocument())
  })
})
