import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DeckDetailPage } from './DeckDetailPage'
import * as decksApi from '../api/decksApi'
import * as exercisesApi from '../api/exercisesApi'
import * as progressApi from '../api/progressApi'
import type { Deck } from '../types/deck'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'test@example.com', role: 'user' }, isGuest: false }),
}))

const activeDeck: Deck = {
  id: '1',
  slug: 'test-deck',
  title: 'Test Deck',
  description: '',
  origin: 'community',
  studyModes: ['practice', 'exam'],
  facetDefinitions: [],
  locales: ['en'],
}

const pausedDeck: Deck = {
  ...activeDeck,
  learningPaused: true,
}

function mockLoads(loaded: Deck) {
  vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(loaded)
  vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])
  vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
}

function renderPage(deck: Deck) {
  mockLoads(deck)
  return render(
    <MemoryRouter initialEntries={[`/deck/${deck.slug}`]}>
      <Routes>
        <Route path="/deck/:slug" element={<DeckDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DeckDetailPage — stop learning', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('stops learning after confirmation and shows the paused state', async () => {
    mockLoads(activeDeck)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const setPaused = vi.spyOn(decksApi, 'setDeckLearningPaused').mockResolvedValue()

    renderPage(activeDeck)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Stop learning' }))

    expect(setPaused).toHaveBeenCalledWith('1', true)
    expect(await screen.findByText('Learning paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume learning' })).toBeInTheDocument()
  })

  test('does nothing when the confirmation is cancelled', async () => {
    mockLoads(activeDeck)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const setPaused = vi.spyOn(decksApi, 'setDeckLearningPaused').mockResolvedValue()

    renderPage(activeDeck)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Stop learning' }))

    expect(setPaused).not.toHaveBeenCalled()
    expect(screen.queryByText('Learning paused')).not.toBeInTheDocument()
  })

  test('resumes a paused deck without asking', async () => {
    mockLoads(pausedDeck)
    const confirm = vi.spyOn(window, 'confirm')
    const setPaused = vi.spyOn(decksApi, 'setDeckLearningPaused').mockResolvedValue()

    renderPage(pausedDeck)
    expect(await screen.findByText('Learning paused')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Resume learning' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(setPaused).toHaveBeenCalledWith('1', false)
    await waitFor(() => expect(screen.queryByText('Learning paused')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Stop learning' })).toBeInTheDocument()
  })
})

describe('DeckDetailPage — paused deck must hide study buttons', () => {
  test('paused deck: Start practicing button must not be shown', async () => {
    renderPage(pausedDeck)

    await screen.findByText('Test Deck')
    expect(screen.getByText('Learning paused')).toBeInTheDocument()

    // Bug: these buttons should NOT be present for paused decks
    expect(screen.queryByRole('button', { name: /start practicing/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /start practicing/i })).not.toBeInTheDocument()
  })

  test('paused deck: Start exam button must not be shown', async () => {
    renderPage(pausedDeck)

    await screen.findByText('Test Deck')

    expect(screen.queryByRole('button', { name: /start exam/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /start exam/i })).not.toBeInTheDocument()
  })

  test('active deck: Start practicing button IS shown', async () => {
    renderPage(activeDeck)

    await screen.findByText('Test Deck')
    expect(screen.queryByText('Learning paused')).not.toBeInTheDocument()

    // Should have practice button
    expect(screen.getByRole('link', { name: /start practicing/i })).toBeInTheDocument()
  })

  test('active deck: Start exam button IS shown', async () => {
    renderPage(activeDeck)

    await screen.findByText('Test Deck')

    // Should have exam button
    expect(screen.getByRole('link', { name: /start exam/i })).toBeInTheDocument()
  })
})
