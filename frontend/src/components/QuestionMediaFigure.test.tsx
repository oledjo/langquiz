import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { QuestionMediaFigure } from './QuestionMediaFigure'

describe('QuestionMediaFigure', () => {
  test('renders nothing when media is undefined', () => {
    const { container } = render(<QuestionMediaFigure media={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  // The picture is what these questions are answered from, so when it has not been sourced yet the
  // official description of it takes its place rather than disappearing.
  test('renders the description when media.url is null', () => {
    render(
      <QuestionMediaFigure
        media={{ kind: 'image', url: null, alt: 'Abgebildet ist ein großes, quaderförmiges Gebäude.' }}
      />
    )

    expect(screen.getByText('Abgebildet ist ein großes, quaderförmiges Gebäude.')).toBeInTheDocument()
    expect(screen.getByText(/image description/i)).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })

  test('renders nothing when media.url is null and there is no description either', () => {
    const { container } = render(<QuestionMediaFigure media={{ kind: 'image', url: null, alt: '   ' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('renders an image resolved against the API base URL, with alt text', () => {
    render(
      <QuestionMediaFigure
        media={{ kind: 'image', url: '/static/images/einburgertest/q55-reichstag-building.jpg', alt: 'Reichstag' }}
      />
    )

    const img = screen.getByAltText('Reichstag')
    expect(img).toHaveAttribute('src', expect.stringContaining('/static/images/einburgertest/q55-reichstag-building.jpg'))
  })

  test('renders an attribution caption when present', () => {
    render(
      <QuestionMediaFigure
        media={{
          kind: 'image',
          url: '/static/images/einburgertest/q55-reichstag-building.jpg',
          alt: 'Reichstag',
          attribution: 'Jürgen Matern / Wikimedia Commons, CC BY-SA 3.0',
        }}
      />
    )

    expect(screen.getByText('Jürgen Matern / Wikimedia Commons, CC BY-SA 3.0')).toBeInTheDocument()
  })

  test('renders no attribution caption when absent', () => {
    render(
      <QuestionMediaFigure
        media={{ kind: 'image', url: '/static/images/einburgertest/q55-reichstag-building.jpg', alt: 'Reichstag' }}
      />
    )

    expect(document.querySelector('figcaption')).not.toBeInTheDocument()
  })
})
