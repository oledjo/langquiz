import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { QuestionCountPicker } from './QuestionCountPicker'

describe('QuestionCountPicker', () => {
  test('shows preset buttons up to the total available, plus an All option', () => {
    render(<QuestionCountPicker totalAvailable={40} onConfirm={vi.fn()} />)

    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '25' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All (40)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '50' })).not.toBeInTheDocument()
  })

  test('calls onConfirm with the chosen preset count', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<QuestionCountPicker totalAvailable={40} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: '25' }))

    expect(onConfirm).toHaveBeenCalledWith(25)
  })

  test('does not duplicate a preset that equals the total available', () => {
    render(<QuestionCountPicker totalAvailable={10} onConfirm={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: /10/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'All (10)' })).toBeInTheDocument()
  })

  test('accepts a custom question count, capped at the total available', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<QuestionCountPicker totalAvailable={40} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByLabelText(/custom number/i), { target: { value: '999' } })
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(onConfirm).toHaveBeenCalledWith(40)
  })

  test('ignores an invalid custom count', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<QuestionCountPicker totalAvailable={40} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByLabelText(/custom number/i), { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(onConfirm).not.toHaveBeenCalled()
  })
})
