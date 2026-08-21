import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { QuizCard } from './QuizCard'
import type { Exercise } from '../types/exercise'

const authState = vi.hoisted(() => ({
  current: {
    user: { id: 1, email: 'test@example.com', role: 'user' as const } as
      | { id: number; email: string; role: 'user' | 'admin' }
      | null,
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

const exercise: Exercise = {
  id: 'de-articles-1',
  type: 'selection',
  topic: 'grammar',
  subtopic: 'articles',
  language: 'de',
  difficulty: 1,
  prompt: 'Which article is correct for "Hund"?',
  options: ['der', 'die', 'das'],
  answer: 0,
  voteCount: 3,
}

function renderCard() {
  render(<QuizCard exercise={exercise} onComplete={vi.fn()} onNext={vi.fn()} />)
}

describe('QuizCard voting', () => {
  afterEach(() => {
    authState.current = {
      ...authState.current,
      isGuest: false,
      user: { id: 1, email: 'test@example.com', role: 'user' },
    }
  })

  test('offers the vote control to a signed-in user', () => {
    renderCard()

    expect(screen.getByRole('button', { name: /vote/i })).toBeInTheDocument()
  })

  // Guests can practice official decks without an account, but every vote endpoint requires
  // one — so the control is absent for them rather than failing when pressed.
  test('hides the vote control from a guest', () => {
    authState.current = { ...authState.current, isGuest: true, user: null }

    renderCard()

    expect(screen.queryByRole('button', { name: /vote/i })).not.toBeInTheDocument()
  })
})
