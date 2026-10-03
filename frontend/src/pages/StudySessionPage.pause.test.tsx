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
    expect(screen.queryByText(/How many questions/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Question 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Question 2')).not.toBeInTheDocument()
    
    // Should show paused message
    expect(screen.getByText('Learning paused')).toBeInTheDocument()
  })

  test('deck with paused topic: exercises from that topic do not appear', async () => {
    const deckWithPausedTopic = { ...activeDeck, pausedTopics: ['verbs'] }
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(deckWithPausedTopic)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    renderPage('paused-deck')
    
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())

    // Should show question picker since deck is active
    expect(screen.getByText(/How many questions/i)).toBeInTheDocument()
    
    // But should only show 1 available (nouns topic), not 2 (verbs topic is paused)
    expect(screen.getByText(/1.*available in this deck/i)).toBeInTheDocument()
  })

  test('active deck: exercises CAN appear', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(activeDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    renderPage('paused-deck')
    
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())

    // Should show question count picker (normal behavior)
    expect(screen.getByText(/How many questions/i)).toBeInTheDocument()
  })

  test('fully paused deck shows message instead of exercises', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(pausedDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(exercises)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    renderPage('paused-deck')
    
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())

    // Should show paused message
    expect(screen.getByText('Learning paused')).toBeInTheDocument()
    expect(screen.getByText(/resume it from the deck page/i)).toBeInTheDocument()
    
    // Should NOT show question picker
    expect(screen.queryByText(/How many questions/i)).not.toBeInTheDocument()
  })
})
