import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { QuizSession } from './QuizSession'
import type { Exercise } from '../types/exercise'
import { postResult } from '../api/progressApi'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ isGuest: false, user: { id: 1, role: 'user' } }),
}))
vi.mock('../api/progressApi', () => ({ postResult: vi.fn() }))
vi.mock('../analytics/client', () => ({ trackEvent: vi.fn() }))

const exercises: Exercise[] = ['First question', 'Second question'].map((prompt, index) => ({
  id: String(index), type: 'selection', topic: 'grammar', subtopic: 'articles',
  language: 'de', difficulty: 1, prompt, options: ['der', 'die'], answer: 0,
}))

test('skips unanswered questions, finishes without grading, and resets on retry', () => {
  render(<QuizSession exercises={exercises} />)
  fireEvent.click(screen.getByRole('button', { name: 'Skip question' }))
  expect(screen.getByText('Second question')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Skip question' }))
  expect(screen.getByText('Session Complete!')).toBeInTheDocument()
  expect(screen.getByText('No questions answered.')).toBeInTheDocument()
  expect(screen.getByText(/2 skipped/)).toBeInTheDocument()
  expect(postResult).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
  expect(screen.getByText('First question')).toBeInTheDocument()
  expect(screen.queryByText(/2 skipped/)).not.toBeInTheDocument()
})

test('does not allow skipping after an answer has been checked', () => {
  render(<QuizSession exercises={exercises} />)
  fireEvent.click(screen.getByText('der'))
  fireEvent.click(screen.getByRole('button', { name: /Check Answer/i }))
  expect(screen.queryByRole('button', { name: 'Skip question' })).not.toBeInTheDocument()
})
