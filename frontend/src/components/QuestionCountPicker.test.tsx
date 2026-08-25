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

  test('omits the untried-only checkbox when its props are not provided', () => {
    render(<QuestionCountPicker totalAvailable={40} onConfirm={vi.fn()} />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('shows the untried-only checkbox with its available count when wired up', () => {
    render(
      <QuestionCountPicker
        totalAvailable={40}
        onConfirm={vi.fn()}
        untriedOnly={false}
        onUntriedOnlyChange={vi.fn()}
        untriedCount={12}
      />
    )

    expect(screen.getByText(/only questions i haven't tried yet \(12 available\)/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  test('toggling the untried-only checkbox reports the new value', async () => {
    const user = userEvent.setup()
    const onUntriedOnlyChange = vi.fn()
    render(
      <QuestionCountPicker
        totalAvailable={40}
        onConfirm={vi.fn()}
        untriedOnly={false}
        onUntriedOnlyChange={onUntriedOnlyChange}
        untriedCount={12}
      />
    )

    await user.click(screen.getByRole('checkbox'))

    expect(onUntriedOnlyChange).toHaveBeenCalledWith(true)
  })

  test('disables the untried-only checkbox when there are no untried questions', () => {
    render(
      <QuestionCountPicker
        totalAvailable={40}
        onConfirm={vi.fn()}
        untriedOnly={false}
        onUntriedOnlyChange={vi.fn()}
        untriedCount={0}
      />
    )

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  test('shows a message instead of presets when the filtered pool is empty', () => {
    render(
      <QuestionCountPicker
        totalAvailable={0}
        onConfirm={vi.fn()}
        untriedOnly={true}
        onUntriedOnlyChange={vi.fn()}
        untriedCount={0}
      />
    )

    expect(screen.getByText(/no questions match this filter/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /all/i })).not.toBeInTheDocument()
    // Checked and count is 0 (from the filter itself), so unchecking must stay possible.
    expect(screen.getByRole('checkbox')).not.toBeDisabled()
  })

  test('omits the failed-only checkbox when its props are not provided', () => {
    render(<QuestionCountPicker totalAvailable={40} onConfirm={vi.fn()} />)

    expect(screen.queryByText(/getting wrong/i)).not.toBeInTheDocument()
  })

  test('shows the failed-only checkbox with its available count when wired up', () => {
    render(
      <QuestionCountPicker
        totalAvailable={40}
        onConfirm={vi.fn()}
        failedOnly={false}
        onFailedOnlyChange={vi.fn()}
        failedCount={5}
      />
    )

    expect(screen.getByText(/only questions i'm getting wrong \(5 available\)/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  test('toggling the failed-only checkbox reports the new value', async () => {
    const user = userEvent.setup()
    const onFailedOnlyChange = vi.fn()
    render(
      <QuestionCountPicker
        totalAvailable={40}
        onConfirm={vi.fn()}
        failedOnly={false}
        onFailedOnlyChange={onFailedOnlyChange}
        failedCount={5}
      />
    )

    await user.click(screen.getByRole('checkbox'))

    expect(onFailedOnlyChange).toHaveBeenCalledWith(true)
  })

  test('disables the failed-only checkbox when there are no failed questions', () => {
    render(
      <QuestionCountPicker
        totalAvailable={40}
        onConfirm={vi.fn()}
        failedOnly={false}
        onFailedOnlyChange={vi.fn()}
        failedCount={0}
      />
    )

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  test('disables the failed-only checkbox while untried-only is checked, and vice versa', () => {
    render(
      <QuestionCountPicker
        totalAvailable={40}
        onConfirm={vi.fn()}
        untriedOnly={true}
        onUntriedOnlyChange={vi.fn()}
        untriedCount={10}
        failedOnly={false}
        onFailedOnlyChange={vi.fn()}
        failedCount={5}
      />
    )

    const untriedCheckbox = screen.getByRole('checkbox', { name: /haven't tried yet/i })
    const failedCheckbox = screen.getByRole('checkbox', { name: /getting wrong/i })

    expect(untriedCheckbox).not.toBeDisabled()
    expect(failedCheckbox).toBeDisabled()
  })
})
