import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { StudySessionPage } from './StudySessionPage'
import * as decksApi from '../api/decksApi'
import * as exercisesApi from '../api/exercisesApi'
import * as progressApi from '../api/progressApi'
import type { Deck } from '../types/deck'
import type { Exercise } from '../types/exercise'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'test@example.com', role: 'user' }, isGuest: false }),
}))

const pausedDeck: Deck = {
  id: '1',
  slug: 'paused-deck',
  title: 'Paused Deck',
  description: '',
  origin: 'community',
  studyModes: ['practice'],
  facetDefinitions: [],
  locales: ['en'],
  learningPaused: true,
}

const activeDeck: Deck = {
  ...pausedDeck,
  learningPaused: false,
}

const exercises: Exercise[] = [
  {
    id: 'ex1',
    type: 'selection',
    topic: 'verbs',
    subtopic: 's1',
    language: 'de',
    difficulty: 1,
    prompt: 'Question 1',
    options: ['a', 'b'],
    answer: 0,
  },
  {
    id: 'ex2',
    type: 'selection',
    topic: 'nouns',
    subtopic: 's2',
    language: 'de',
    difficulty: 1,
    prompt: 'Question 2',
    options: ['c', 'd'],
    answer: 1,
  },
]

function renderPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/deck/${slug}/study`]}>
      <Routes>
        <Route path="/deck/:slug/study" element={<StudySessionPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StudySessionPage — paused deck must not show exercises', () => {
  test('paused deck: exercises must not appear in study session', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(pausedDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    renderPage('paused-deck')
    
    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())

    // Should NOT show question count picker or questions
    // Instead should show a message that deck is paused
    expect(screen.queryByText(/Pick.*questions/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Question 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Question 2')).not.toBeInTheDocument()
    
    // Should show paused message (this expectation will guide the fix)
    expect(screen.getByText(/paused|cannot practice/i)).toBeInTheDocument()
  })

  test('paused deck with topic filter: still must not show exercises', async () => {
    const pausedWithTopics = { ...pausedDeck, pausedTopics: ['verbs'] }
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(pausedWithTopics)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={[{ pathname: '/deck/paused-deck/study', state: { topics: ['nouns'] } }]}>
        <Routes>
          <Route path="/deck/:slug/study" element={<StudySessionPage />} />
        </Routes>
      </MemoryRouter>
    )
    
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())

    // Even with topic filter, if a topic is paused, its questions shouldn't appear
    expect(screen.queryByText('Question 2')).not.toBeInTheDocument()
  })

  test('active deck: exercises CAN appear', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(activeDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    renderPage('paused-deck')
    
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())

    // Should show question count picker (normal behavior)
    expect(screen.getByText(/Pick.*questions/i)).toBeInTheDocument()
  })

  test('deck paused after loading: exercises disappear on refetch', async () => {
    const fetchDeck = vi.spyOn(decksApi, 'fetchDeckBySlug')
    fetchDeck.mockResolvedValueOnce(activeDeck) // First load: active
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    const { rerender } = renderPage('paused-deck')
    
    await waitFor(() => expect(screen.getByText(/Pick.*questions/i)).toBeInTheDocument())

    // Simulate deck being paused and page refetch
    fetchDeck.mockResolvedValue(pausedDeck)
    
    // Force re-render (simulates navigation back to page or refresh)
    rerender(
      <MemoryRouter initialEntries={[`/deck/paused-deck/study`]}>
        <Routes>
          <Route path="/deck/:slug/study" element={<StudySessionPage />} />
        </Routes>
      </MemoryRouter>
    )

    // After refetch with paused deck, should not show picker
    await waitFor(() => expect(screen.queryByText(/Pick.*questions/i)).not.toBeInTheDocument())
    expect(screen.getByText(/paused|cannot practice/i)).toBeInTheDocument()
  })
})
