import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { QuestionInput } from '../../api/deckEditorApi'
import { QuestionForm } from './QuestionForm'
import { draftError, draftFromQuestion, questionFromDraft, EMPTY_DRAFT } from './questionDraft'

describe('questionDraft', () => {
  test('round-trips each question type', () => {
    const questions: QuestionInput[] = [
      { type: 'selection', prompt: 'Q', options: ['a', 'b'], answer: 1, difficulty: 2 },
      { type: 'multiselect', prompt: 'Q', options: ['a', 'b', 'c'], answers: [0, 2], difficulty: 2 },
      { type: 'free-type', prompt: 'Q', answers: ['x', 'y'], difficulty: 2, explanation: 'why' },
    ]
    for (const q of questions) expect(questionFromDraft(draftFromQuestion(q))).toEqual(q)
  })

  test('flags incomplete drafts', () => {
    expect(draftError(EMPTY_DRAFT)).toMatch(/Write the question/)
    expect(draftError({ ...EMPTY_DRAFT, prompt: 'Q' })).toMatch(/empty options/)
    expect(draftError({ ...EMPTY_DRAFT, prompt: 'Q', type: 'free-type' })).toMatch(/accepted answer/)
    expect(draftError({ ...EMPTY_DRAFT, prompt: 'Q', options: ['a', 'b'], correct: [] })).toMatch(/Mark the correct/)
  })
})

describe('QuestionForm', () => {
  test('builds a selection question from the inputs', () => {
    const onSave = vi.fn()
    render(<QuestionForm onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Capital of Italy?' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Milan' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'Rome' } })
    fireEvent.click(screen.getByLabelText('Remove option 3'))
    fireEvent.click(screen.getByLabelText('Option 2 is correct'))
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }))
    expect(onSave).toHaveBeenCalledWith({ type: 'selection', prompt: 'Capital of Italy?', options: ['Milan', 'Rome'], answer: 1, difficulty: 2 })
  })

  test('shows the problem instead of saving an incomplete question', () => {
    const onSave = vi.fn()
    render(<QuestionForm onSave={onSave} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Typed answer' }))
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: '2 + 2?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one accepted answer.')
    expect(onSave).not.toHaveBeenCalled()
  })
})
