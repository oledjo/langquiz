import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { SelectionQuestion } from './SelectionQuestion'
import type { SelectionExercise } from '../../types/exercise'

const exercise: SelectionExercise = {
  id: 'ex-1',
  type: 'selection',
  topic: 't',
  subtopic: 's',
  language: 'de',
  difficulty: 1,
  prompt: 'Which is correct?',
  options: ['der', 'die', 'das'],
  answer: 0,
}

describe('SelectionQuestion', () => {
  test('before answering, no option is marked correct/incorrect', () => {
    render(<SelectionQuestion exercise={exercise} onAnswer={vi.fn()} disabled={false} />)

    expect(screen.queryByText('Correct answer')).not.toBeInTheDocument()
  })

  test('after picking the wrong answer, the correct option is revealed', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    const { rerender } = render(
      <SelectionQuestion exercise={exercise} onAnswer={onAnswer} disabled={false} />
    )
    await user.click(screen.getByRole('button', { name: 'die' }))
    expect(onAnswer).toHaveBeenCalledWith({ type: 'selection', selectedIndex: 1 })

    rerender(
      <SelectionQuestion
        exercise={exercise}
        onAnswer={onAnswer}
        disabled
        validationResult={{ correct: false }}
      />
    )

    expect(screen.getByRole('button', { name: /der/ })).toHaveClass('border-emerald-400')
    expect(screen.getByRole('button', { name: /die/ })).toHaveClass('border-red-400')
    expect(screen.getByText('Correct answer')).toBeInTheDocument()
  })

  test('after picking the correct answer, only the correct option is highlighted, no extra label', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    const { rerender } = render(
      <SelectionQuestion exercise={exercise} onAnswer={onAnswer} disabled={false} />
    )
    await user.click(screen.getByRole('button', { name: 'der' }))

    rerender(
      <SelectionQuestion
        exercise={exercise}
        onAnswer={onAnswer}
        disabled
        validationResult={{ correct: true }}
      />
    )

    expect(screen.getByRole('button', { name: /der/ })).toHaveClass('border-emerald-400')
    expect(screen.queryByText('Correct answer')).not.toBeInTheDocument()
  })
})

describe('SelectionQuestion with optionImages', () => {
  const imageExercise: SelectionExercise = {
    ...exercise,
    options: ['Bild 1', 'Bild 2', 'Bild 3'],
    answer: 1,
    optionImages: [
      { kind: 'image', url: '/static/images/a.svg', alt: 'Wappen A' },
      { kind: 'image', url: '/static/images/b.svg', alt: 'Wappen B' },
      { kind: 'image', url: '/static/images/c.svg', alt: 'Wappen C' },
    ],
  }

  test('renders one image per option, resolved against the API base URL', () => {
    render(<SelectionQuestion exercise={imageExercise} onAnswer={vi.fn()} disabled={false} />)

    const img = screen.getByAltText('Wappen B')
    expect(img.tagName).toBe('IMG')
    expect(img).toHaveAttribute('src', expect.stringContaining('/static/images/b.svg'))
  })

  test('clicking an image option still reports the correct selectedIndex', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<SelectionQuestion exercise={imageExercise} onAnswer={onAnswer} disabled={false} />)

    await user.click(screen.getByAltText('Wappen C').closest('button')!)

    expect(onAnswer).toHaveBeenCalledWith({ type: 'selection', selectedIndex: 2 })
  })

  test('correct/incorrect highlighting still works when options are images', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const { rerender } = render(
      <SelectionQuestion exercise={imageExercise} onAnswer={onAnswer} disabled={false} />
    )
    await user.click(screen.getByAltText('Wappen A').closest('button')!)

    rerender(
      <SelectionQuestion
        exercise={imageExercise}
        onAnswer={onAnswer}
        disabled
        validationResult={{ correct: false }}
      />
    )

    expect(screen.getByAltText('Wappen B').closest('button')).toHaveClass('border-emerald-400')
    expect(screen.getByAltText('Wappen A').closest('button')).toHaveClass('border-red-400')
  })
})

describe('SelectionQuestion with per-option pictures', () => {
  const pickerExercise: SelectionExercise = {
    id: 'ebt-21',
    type: 'selection',
    topic: 'einbuergerungstest',
    subtopic: 'general',
    language: 'de',
    difficulty: 3,
    prompt: 'Welches ist das Wappen der Bundesrepublik Deutschland?',
    options: ['Bild 1', 'Bild 2'],
    answer: 0,
  }

  test('renders each option as a picture when the pictures are sourced', () => {
    render(
      <SelectionQuestion
        exercise={{
          ...pickerExercise,
          optionImages: [
            { kind: 'image', url: '/static/images/einburgertest/a.svg', alt: 'Bundesadler' },
            { kind: 'image', url: '/static/images/einburgertest/b.svg', alt: 'Christusmonogramm' },
          ],
        }}
        onAnswer={vi.fn()}
        disabled={false}
      />
    )

    expect(screen.getByAltText('Bundesadler')).toHaveAttribute(
      'src',
      expect.stringContaining('/static/images/einburgertest/a.svg')
    )
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  // Without this the option reads "Bild 2" and nothing else, which cannot be answered.
  test('renders each option’s description when the pictures are not sourced yet', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <SelectionQuestion
        exercise={{
          ...pickerExercise,
          optionImages: [
            { kind: 'image', url: null, alt: 'Ein schwarzer Adler auf goldgelbem Grund.' },
            { kind: 'image', url: null, alt: 'Zwei sich kreuzende griechische Buchstaben.' },
          ],
        }}
        onAnswer={onAnswer}
        disabled={false}
      />
    )

    expect(screen.getByText('Ein schwarzer Adler auf goldgelbem Grund.')).toBeInTheDocument()
    expect(screen.getByText('Zwei sich kreuzende griechische Buchstaben.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Zwei sich kreuzende/ }))
    expect(onAnswer).toHaveBeenCalledWith({ type: 'selection', selectedIndex: 1 })
  })
})
