import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DeckDetailPage } from './DeckDetailPage'
import * as decksApi from '../api/decksApi'

function renderAtSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/deck/${slug}`]}>
      <Routes>
        <Route path="/deck/:slug" element={<DeckDetailPage />} />
      </Routes>
    </MemoryRouter>
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

  test('links back to the library', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    renderAtSlug('does-not-exist')

    await waitFor(() => expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute('href', '/library')
  })
})
