import type { QuestionInput } from '../../api/deckEditorApi'
import type { ExerciseType } from '../../types/exercise'

/** Editable form state for one question; converted to/from the API shape at the edges. */
export interface QuestionDraft {
  type: ExerciseType
  prompt: string
  options: string[]
  correct: number[]
  /** free-type accepted answers, one per line */
  answersText: string
  explanation: string
}

export const EMPTY_DRAFT: QuestionDraft = {
  type: 'selection',
  prompt: '',
  options: ['', '', ''],
  correct: [0],
  answersText: '',
  explanation: '',
}

export function draftFromQuestion(q: QuestionInput): QuestionDraft {
  if (q.type === 'free-type') {
    return { ...EMPTY_DRAFT, type: q.type, prompt: q.prompt, options: [], correct: [], answersText: q.answers.join('\n'), explanation: q.explanation ?? '' }
  }
  return {
    type: q.type,
    prompt: q.prompt,
    options: [...q.options],
    correct: q.type === 'selection' ? [q.answer] : [...q.answers],
    answersText: '',
    explanation: q.explanation ?? '',
  }
}

/** Client-side checks mirroring the server's, so the user sees problems before saving. */
export function draftError(d: QuestionDraft): string | null {
  if (!d.prompt.trim()) return 'Write the question.'
  if (d.type === 'free-type') {
    return d.answersText.split('\n').some((a) => a.trim()) ? null : 'Add at least one accepted answer.'
  }
  const options = d.options.map((o) => o.trim())
  if (options.length < 2) return 'Add at least two options.'
  if (options.some((o) => !o)) return 'Fill in or remove empty options.'
  if (d.correct.length === 0) return 'Mark the correct option.'
  return null
}

export function questionFromDraft(d: QuestionDraft): QuestionInput {
  const base = { prompt: d.prompt.trim(), difficulty: 2 as const, ...(d.explanation.trim() ? { explanation: d.explanation.trim() } : {}) }
  if (d.type === 'free-type') {
    return { ...base, type: 'free-type', answers: d.answersText.split('\n').map((a) => a.trim()).filter(Boolean) }
  }
  const options = d.options.map((o) => o.trim())
  if (d.type === 'selection') return { ...base, type: 'selection', options, answer: d.correct[0] ?? 0 }
  return { ...base, type: 'multiselect', options, answers: [...d.correct].sort((a, b) => a - b) }
}
