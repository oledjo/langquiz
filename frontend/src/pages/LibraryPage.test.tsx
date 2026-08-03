import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { LibraryPage } from './LibraryPage'
import * as decksApi from '../api/decksApi'

describe('LibraryPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows a loading state, then the fetched decks', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([
      {
        id: '1',
        slug: 'german-grammar-vocabulary',
        title: 'German Grammar & Vocabulary',
        description: 'Practice German grammar and vocabulary.',
        origin: 'official',
        studyModes: ['practice'],
        facetDefinitions: [],
        locales: ['en'],
      },
    ])

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.getByText('Practice German grammar and vocabulary.')).toBeInTheDocument()
  })

  test('shows an empty state when there are no decks', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([])

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/no decks/i)).toBeInTheDocument())
  })

  test('shows an error message when the fetch fails', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockRejectedValue(new Error('GET /api/decks failed: 500'))

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/GET \/api\/decks failed: 500/)).toBeInTheDocument())
  })

  test('links each deck to its detail page', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([
      {
        id: '1',
        slug: 'german-grammar-vocabulary',
        title: 'German Grammar & Vocabulary',
        description: '',
        origin: 'official',
        studyModes: ['practice'],
        facetDefinitions: [],
        locales: ['en'],
      },
    ])

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('link', { name: /German Grammar & Vocabulary/ })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /German Grammar & Vocabulary/ })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary'
    )
  })

  test('renders a card for each deck when there are multiple', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([
      {
        id: '1',
        slug: 'german-grammar-vocabulary',
        title: 'German Grammar & Vocabulary',
        description: '',
        origin: 'official',
        studyModes: ['practice'],
        facetDefinitions: [],
        locales: ['en'],
      },
      {
        id: '2',
        slug: 'einbuergerungstest',
        title: 'Einbürgerungstest',
        description: '',
        origin: 'official',
        studyModes: ['practice', 'exam'],
        facetDefinitions: [],
        locales: ['en'],
      },
    ])

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2))
    expect(screen.getByRole('link', { name: /German Grammar & Vocabulary/ })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary'
    )
    expect(screen.getByRole('link', { name: /Einbürgerungstest/ })).toHaveAttribute(
      'href',
      '/deck/einbuergerungstest'
    )
  })

  test('truncates a long title and description instead of overflowing the card', async () => {
    const longTitle = 'A'.repeat(200)
    const longDescription = 'B'.repeat(500)
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([
      {
        id: '1',
        slug: 'long',
        title: longTitle,
        description: longDescription,
        origin: 'official',
        studyModes: ['practice'],
        facetDefinitions: [],
        locales: ['en'],
      },
    ])

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(longTitle)).toBeInTheDocument())
    expect(screen.getByText(longTitle)).toHaveClass('truncate')
    expect(screen.getByText(longDescription)).toHaveClass('truncate')
  })
})
