import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { StudySessionPage } from './StudySessionPage'
import { AuthProvider } from '../auth/AuthContext'
import * as decksApi from '../api/decksApi'
import * as exercisesApi from '../api/exercisesApi'

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

function renderAtSlug(slug: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/deck/${slug}/study`]}>
        <Routes>
          <Route path="/deck/:slug/study" element={<StudySessionPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('StudySessionPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows a loading state, then the first question from the deck', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([mockExercise])

    renderAtSlug('german-grammar-vocabulary')

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

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
})
