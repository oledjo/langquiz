import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ExamSessionPage } from './ExamSessionPage'
import { AuthProvider } from '../auth/AuthContext'
import * as decksApi from '../api/decksApi'
import * as exercisesApi from '../api/exercisesApi'
import * as progressApi from '../api/progressApi'

const mockDeck = {
  id: '1',
  slug: 'test-deck',
  title: 'Test Deck',
  description: '',
  origin: 'official' as const,
  studyModes: ['practice' as const, 'exam' as const],
  facetDefinitions: [],
  locales: ['en'],
  examConfig: {
    questionCount: 2,
    passingScore: 2,
    quotas: [{ facetKey: 'group', facetValue: 'grammar', count: 2 }],
  },
}

const mockExercises = [
  {
    id: 'ex-1',
    type: 'selection' as const,
    topic: 'articles',
    subtopic: 'der',
    language: 'de',
    group: 'grammar' as const,
    difficulty: 1 as const,
    prompt: 'Which article is correct for "Hund"?',
    options: ['der', 'die', 'das'],
    answer: 0,
  },
  {
    id: 'ex-2',
    type: 'selection' as const,
    topic: 'articles',
    subtopic: 'die',
    language: 'de',
    group: 'grammar' as const,
    difficulty: 1 as const,
    prompt: 'Which article is correct for "Katze"?',
    options: ['der', 'die', 'das'],
    answer: 1,
  },
]

function renderAtSlug(slug: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/deck/${slug}/exam`]}>
        <Routes>
          <Route path="/deck/:slug/exam" element={<ExamSessionPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('ExamSessionPage', () => {
  beforeEach(() => {
    // selectExamQuestions (Task 3, out of scope here) shuffles via Math.random with no seam for
    // deterministic tests. Without this, the exam's question order is randomized per run, and the
    // click-by-answer-text assertions below (which assume Q1 = ex-1, Q2 = ex-2) are flaky ~50% of
    // the time. Pinning Math.random to 0 makes the two shuffle() calls in selectExamQuestions
    // cancel out for this 2-item, single-quota case, reproducing the original array order.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows a loading state, then the first exam question', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(mockExercises)

    renderAtSlug('test-deck')

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Question 1 of 2')).toBeInTheDocument())
  })

  test('shows a not-found message when the deck does not exist', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    renderAtSlug('does-not-exist')

    await waitFor(() => expect(screen.getByText(/deck not found/i)).toBeInTheDocument())
  })

  test('shows a message when the deck has no exam mode configured', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue({
      ...mockDeck,
      studyModes: ['practice'],
      examConfig: undefined,
    })
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(mockExercises)

    renderAtSlug('test-deck')

    await waitFor(() => expect(screen.getByText(/does not offer an exam/i)).toBeInTheDocument())
  })

  test('lets the user navigate between questions and submit for a score', async () => {
    const user = userEvent.setup()
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(mockExercises)
    const postResultSpy = vi.spyOn(progressApi, 'postResult').mockResolvedValue(undefined)

    renderAtSlug('test-deck')

    await waitFor(() => expect(screen.getByText('Question 1 of 2')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'der' }))

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('Question 2 of 2')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'die' }))

    await user.click(screen.getByRole('button', { name: 'Submit exam' }))

    await waitFor(() => expect(screen.getByText(/2 \/ 2 correct/i)).toBeInTheDocument())
    expect(screen.getByText(/Passed/i)).toBeInTheDocument()
    expect(postResultSpy).toHaveBeenCalledTimes(2)
    expect(postResultSpy).toHaveBeenCalledWith('ex-1', true, 'good', 'exam')
    expect(postResultSpy).toHaveBeenCalledWith('ex-2', true, 'good', 'exam')
  })

  test('shows a review of every question with the given answer and correct answer after submitting', async () => {
    const user = userEvent.setup()
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(mockExercises)
    vi.spyOn(progressApi, 'postResult').mockResolvedValue(undefined)

    renderAtSlug('test-deck')

    await waitFor(() => expect(screen.getByText('Question 1 of 2')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'die' })) // wrong: correct is 'der'
    // Question 2 is left unanswered.
    await user.click(screen.getByRole('button', { name: 'Submit exam' }))

    await waitFor(() => expect(screen.getByText(/0 \/ 2 correct/i)).toBeInTheDocument())

    expect(screen.getByText(/1\. Which article is correct for "Hund"\?/)).toBeInTheDocument()
    expect(screen.getByText(/2\. Which article is correct for "Katze"\?/)).toBeInTheDocument()
    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText('Skipped')).toBeInTheDocument()
    expect(screen.getAllByText(/Your answer:/)).toHaveLength(2)
    expect(screen.getAllByText(/Correct answer:/)).toHaveLength(2)
  })

  test('scores unanswered questions as incorrect and does not submit progress for them', async () => {
    const user = userEvent.setup()
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(mockExercises)
    const postResultSpy = vi.spyOn(progressApi, 'postResult').mockResolvedValue(undefined)

    renderAtSlug('test-deck')

    await waitFor(() => expect(screen.getByText('Question 1 of 2')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'der' }))
    // Question 2 is left unanswered.
    await user.click(screen.getByRole('button', { name: 'Submit exam' }))

    await waitFor(() => expect(screen.getByText(/1 \/ 2 correct/i)).toBeInTheDocument())
    expect(screen.getByText(/Not passed/i)).toBeInTheDocument()
    expect(postResultSpy).toHaveBeenCalledTimes(1)
    expect(postResultSpy).toHaveBeenCalledWith('ex-1', true, 'good', 'exam')
  })

  test('does not carry the previous question\'s selection over to the next question', async () => {
    const user = userEvent.setup()
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(mockExercises)

    renderAtSlug('test-deck')

    await waitFor(() => expect(screen.getByText('Question 1 of 2')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'der' }))
    expect(screen.getByRole('button', { name: 'der' })).toHaveClass('border-blue-500')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('Question 2 of 2')).toBeInTheDocument())

    // Q2 has the same option text at the same index ('der' at index 0) as Q1. Regression check
    // for the missing `key` prop that let SelectionQuestion's internal `selected` state survive
    // across questions and show a stale selection here.
    expect(screen.getByRole('button', { name: 'der' })).not.toHaveClass('border-blue-500')
    expect(screen.getByRole('button', { name: 'die' })).not.toHaveClass('border-blue-500')
    expect(screen.getByRole('button', { name: 'das' })).not.toHaveClass('border-blue-500')
  })
})
