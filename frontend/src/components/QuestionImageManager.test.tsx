import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { QuestionImageManager } from './QuestionImageManager'
import * as adminApi from '../api/adminApi'
import type { Exercise } from '../types/exercise'

const exercise: Exercise = {
  id: 'ebt-21',
  type: 'selection',
  topic: 'einbuergerungstest',
  subtopic: 'general',
  language: 'de',
  difficulty: 3,
  prompt: 'Welches ist das Wappen der Bundesrepublik Deutschland?',
  options: ['Bild 1', 'Bild 2'],
  answer: 0,
  optionImages: [
    { kind: 'image', url: null, alt: 'Ein schwarzer Adler auf goldgelbem Grund.' },
    { kind: 'image', url: null, alt: 'Zwei sich kreuzende griechische Buchstaben.' },
  ],
}

describe('QuestionImageManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(adminApi, 'fetchQuestionImages').mockResolvedValue([])
  })

  test('offers a slot for the question plus one per answer option', async () => {
    render(<QuestionImageManager exercise={exercise} />)

    await waitFor(() => expect(screen.getByText('Question image')).toBeInTheDocument())
    expect(screen.getByText('Option 1 — Bild 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2 — Bild 2')).toBeInTheDocument()
    expect(screen.getAllByText('No image')).toHaveLength(3)
  })

  test('prefills each slot with the description already on the question', async () => {
    render(<QuestionImageManager exercise={exercise} />)

    await waitFor(() =>
      expect(screen.getByDisplayValue('Ein schwarzer Adler auf goldgelbem Grund.')).toBeInTheDocument()
    )
    expect(screen.getByDisplayValue('Zwei sich kreuzende griechische Buchstaben.')).toBeInTheDocument()
  })

  // The description travels with the upload, so a picture never lands without alt text.
  test('uploads the chosen file into its slot, with that slot’s description', async () => {
    const upload = vi.spyOn(adminApi, 'uploadQuestionImage').mockResolvedValue()
    const user = userEvent.setup()

    render(<QuestionImageManager exercise={exercise} />)
    await waitFor(() => expect(screen.getByText('Option 1 — Bild 1')).toBeInTheDocument())

    const file = new File(['<svg/>'], 'adler.svg', { type: 'image/svg+xml' })
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]')
    await user.upload(inputs[1], file)

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith('ebt-21', '0', file, 'Ein schwarzer Adler auf goldgelbem Grund.')
    )
  })

  test('shows the stored image and its size once a slot has one', async () => {
    vi.spyOn(adminApi, 'fetchQuestionImages').mockResolvedValue([
      {
        slot: 'question',
        contentType: 'image/png',
        alt: 'Bundesadler',
        attribution: null,
        size: 20480,
        updatedAt: '2026-08-21T12:00:00.000Z',
      },
    ])

    render(<QuestionImageManager exercise={exercise} />)

    await waitFor(() => expect(screen.getByAltText('Bundesadler')).toBeInTheDocument())
    expect(screen.getByText('png · 20 KB')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  test('refuses a file over the size limit without calling the API', async () => {
    const upload = vi.spyOn(adminApi, 'uploadQuestionImage').mockResolvedValue()
    const user = userEvent.setup()

    render(<QuestionImageManager exercise={exercise} />)
    await waitFor(() => expect(screen.getByText('Question image')).toBeInTheDocument())

    const tooBig = new File([new Uint8Array(3 * 1024 * 1024)], 'huge.png', { type: 'image/png' })
    await user.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, tooBig)

    await waitFor(() => expect(screen.getByText(/the limit is 2 MB/i)).toBeInTheDocument())
    expect(upload).not.toHaveBeenCalled()
  })
})
