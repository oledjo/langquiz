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

const deck: Deck = {
  id: '5',
  slug: 'my-deck',
  title: 'My Deck',
  description: '',
  origin: 'community',
  studyModes: ['practice'],
  facetDefinitions: [],
  locales: ['en'],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/deck/my-deck']}>
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

  function mockLoads(loaded: Deck) {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(loaded)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
  }

  test('stops learning after confirmation and shows the paused state', async () => {
    mockLoads(deck)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const setPaused = vi.spyOn(decksApi, 'setDeckLearningPaused').mockResolvedValue()

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Stop learning' }))

    expect(setPaused).toHaveBeenCalledWith('5', true)
    expect(await screen.findByText('Learning paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume learning' })).toBeInTheDocument()
  })

  test('does nothing when the confirmation is cancelled', async () => {
    mockLoads(deck)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const setPaused = vi.spyOn(decksApi, 'setDeckLearningPaused').mockResolvedValue()

    renderPage()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Stop learning' }))

    expect(setPaused).not.toHaveBeenCalled()
    expect(screen.queryByText('Learning paused')).not.toBeInTheDocument()
  })

  test('resumes a paused deck without asking', async () => {
    mockLoads({ ...deck, learningPaused: true })
    const confirm = vi.spyOn(window, 'confirm')
    const setPaused = vi.spyOn(decksApi, 'setDeckLearningPaused').mockResolvedValue()

    renderPage()
    expect(await screen.findByText('Learning paused')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Resume learning' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(setPaused).toHaveBeenCalledWith('5', false)
    await waitFor(() => expect(screen.queryByText('Learning paused')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Stop learning' })).toBeInTheDocument()
  })
})
