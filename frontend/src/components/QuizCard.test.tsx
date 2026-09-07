import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { QuizCard } from './QuizCard'
import { toDeckExercise } from '../lib/legacyExerciseMapper'
import type { SelectionExercise } from '../types/exercise'

const exercise: SelectionExercise = {
  id: 'gallery', type: 'selection', topic: 'Anki', subtopic: '', language: 'de', difficulty: 1,
  prompt: 'Choose', options: ['Yes', 'No'], answer: 0,
  media: { kind: 'image', url: '/front.png', alt: 'Front' },
  mediaGallery: [{ kind: 'image', url: '/front.png', alt: 'Front' }, { kind: 'image', url: '/extra.png', alt: 'Extra' }],
  explanationMedia: [{ kind: 'image', url: '/answer.png', alt: 'Answer diagram' }],
}

test('shows every front image once and reveals answer images only after checking', () => {
  render(<QuizCard exercise={exercise} onComplete={() => {}} onNext={() => {}} />)
  expect(screen.getAllByAltText('Front')).toHaveLength(1)
  expect(screen.getByAltText('Extra')).toBeInTheDocument()
  expect(screen.queryByAltText('Answer diagram')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }))
  expect(screen.getByAltText('Answer diagram')).toBeInTheDocument()
})

test('deck mapping preserves both sides of media and legacy image', () => {
  const mapped = toDeckExercise(exercise, 'anki')
  expect(mapped.media).toEqual(exercise.media)
  expect(mapped.mediaGallery).toEqual(exercise.mediaGallery)
  expect(mapped.explanationMedia).toEqual(exercise.explanationMedia)
})
