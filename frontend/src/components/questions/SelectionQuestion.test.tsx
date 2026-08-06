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
