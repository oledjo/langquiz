import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
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

function renderPage(deck: Deck) {
  vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(deck)
  vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])
  vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

  return render(
    <MemoryRouter initialEntries={[`/deck/${deck.slug}`]}>
      <Routes>
        <Route path="/deck/:slug" element={<DeckDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

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
