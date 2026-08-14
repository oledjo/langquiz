import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DeckDetailPage } from './DeckDetailPage'
import { AuthProvider } from '../auth/AuthContext'
import * as decksApi from '../api/decksApi'
import * as exercisesApi from '../api/exercisesApi'

function renderAtSlug(slug: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/deck/${slug}`]}>
        <Routes>
          <Route path="/deck/:slug" element={<DeckDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('DeckDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows a loading state, then the deck details', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue({
      id: '1',
      slug: 'german-grammar-vocabulary',
      title: 'German Grammar & Vocabulary',
      description: 'Practice German grammar and vocabulary across CEFR levels.',
      origin: 'official',
      studyModes: ['practice'],
      facetDefinitions: [{ key: 'level', label: 'CEFR level', values: ['A1', 'A2'] }],
      locales: ['en'],
    })
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])

    renderAtSlug('german-grammar-vocabulary')

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.getByText('Practice German grammar and vocabulary across CEFR levels.')).toBeInTheDocument()
    expect(screen.getByText('CEFR level')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start practicing' })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary/study'
    )
  })

  test('shows a not-found message when the deck does not exist', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    renderAtSlug('does-not-exist')

    await waitFor(() => expect(screen.getByText(/deck not found/i)).toBeInTheDocument())
  })

  test('shows an error message when the fetch fails', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockRejectedValue(new Error('GET /api/decks/x failed: 500'))

    renderAtSlug('x')

    await waitFor(() => expect(screen.getByText(/GET \/api\/decks\/x failed: 500/)).toBeInTheDocument())
  })

  test('links back to all decks', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    renderAtSlug('does-not-exist')

    await waitFor(() => expect(screen.getByRole('link', { name: /all decks/i })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /all decks/i })).toHaveAttribute('href', '/')
  })

  test('does not show a Start exam button for a deck without exam in studyModes', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue({
      id: '1',
      slug: 'german-grammar-vocabulary',
      title: 'German Grammar & Vocabulary',
      description: '',
      origin: 'official',
      studyModes: ['practice'],
      facetDefinitions: [],
      locales: ['en'],
    })
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() => expect(screen.getByRole('link', { name: 'Start practicing' })).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Start exam' })).not.toBeInTheDocument()
  })

  test('shows a Start exam button for a deck with exam in studyModes', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue({
      id: '1',
      slug: 'exam-deck',
      title: 'Exam Deck',
      description: '',
      origin: 'official',
      studyModes: ['practice', 'exam'],
      facetDefinitions: [],
      locales: ['en'],
      examConfig: { questionCount: 10, passingScore: 6, quotas: [] },
    })
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])

    renderAtSlug('exam-deck')

    await waitFor(() => expect(screen.getByRole('link', { name: 'Start exam' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Start exam' })).toHaveAttribute('href', '/deck/exam-deck/exam')
  })

  test('shows topic chips for a deck with multiple topics, and toggling one narrows the selection', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue({
      id: '1',
      slug: 'german-grammar-vocabulary',
      title: 'German Grammar & Vocabulary',
      description: '',
      origin: 'official',
      studyModes: ['practice'],
      facetDefinitions: [],
      locales: ['en'],
    })
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([
      { id: 'ex-1', type: 'selection', topic: 'articles', subtopic: 'der', language: 'de', difficulty: 1, prompt: 'p1', options: ['a', 'b'], answer: 0 },
      { id: 'ex-2', type: 'selection', topic: 'verbs', subtopic: 'sein', language: 'de', difficulty: 1, prompt: 'p2', options: ['a', 'b'], answer: 0 },
    ])

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() => expect(screen.getByRole('button', { name: /Articles/ })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Verbs/ })).toBeInTheDocument()
    expect(screen.getByText('All topics selected.')).toBeInTheDocument()

    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.setup().click(screen.getByRole('button', { name: /Articles/ }))

    expect(screen.getByText('1 topic(s) selected.')).toBeInTheDocument()
  })
})
