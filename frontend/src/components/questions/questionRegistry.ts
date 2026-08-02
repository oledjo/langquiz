import type { ComponentType } from 'react'
import type { Exercise, UserAnswer } from '../../types/exercise'
import type { ValidationResult } from '../../validators/answerValidator'
import { MultiSelectQuestion } from './MultiSelectQuestion'
import { FreeTypeQuestion } from './FreeTypeQuestion'
import { SelectionQuestion } from './SelectionQuestion'

export interface QuestionComponentProps<T extends Exercise = Exercise> {
  exercise: T
  onAnswer: (answer: UserAnswer) => void
  disabled?: boolean
  validationResult?: ValidationResult | null
}

// Each component below expects a narrower prop type (e.g. QuestionComponentProps<SelectionExercise>)
// than the registry's declared value type, so this map is inherently contravariant. `any` is the
// correct type-erasure point here — replacing it with `Exercise` fails tsc (see git history).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const questionRegistry: Record<string, ComponentType<QuestionComponentProps<any>>> = {
  selection: SelectionQuestion,
  multiselect: MultiSelectQuestion,
  'free-type': FreeTypeQuestion,
}

export function getQuestionComponent(
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ComponentType<QuestionComponentProps<any>> {
  const component = questionRegistry[type]
  if (!component) {
    throw new Error(
      `No question component registered for type "${type}". Add it to questionRegistry.ts.`
    )
  }
  return component
}
