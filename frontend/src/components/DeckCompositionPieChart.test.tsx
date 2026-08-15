import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { DeckCompositionPieChart, type CompositionSlice } from './DeckCompositionPieChart'

const slices: CompositionSlice[] = [
  { key: 'not-tried', label: 'Not tried yet', value: 5, color: '#c3c2b7' },
  { key: 'mastered', label: 'Always correct', value: 3, color: '#0ca30c' },
  { key: 'mixed', label: 'Mixed results', value: 1, color: '#fab219' },
  { key: 'struggling', label: 'Always missed', value: 0, color: '#d03b3b' },
]

describe('DeckCompositionPieChart', () => {
  test('renders a legend row for every non-zero slice with its count and percentage', () => {
    render(<DeckCompositionPieChart slices={slices} total={9} />)

    expect(screen.getByText('Not tried yet')).toBeInTheDocument()
    expect(screen.getByText('Always correct')).toBeInTheDocument()
    expect(screen.getByText('Mixed results')).toBeInTheDocument()
    expect(screen.queryByText('Always missed')).not.toBeInTheDocument()

    expect(screen.getByText('(56%)')).toBeInTheDocument()
    expect(screen.getByText('(33%)')).toBeInTheDocument()
    expect(screen.getByText('(11%)')).toBeInTheDocument()
  })

  test('shows the deck total in the center of the donut', () => {
    render(<DeckCompositionPieChart slices={slices} total={9} centerLabel="questions" />)

    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('questions')).toBeInTheDocument()
  })

  test('renders an empty state when the deck has no questions', () => {
    render(<DeckCompositionPieChart slices={[]} total={0} />)

    expect(screen.getByText('No questions in this deck yet.')).toBeInTheDocument()
  })
})
