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

export const questionRegistry: Record<string, ComponentType<QuestionComponentProps<any>>> = {
  selection: SelectionQuestion,
  multiselect: MultiSelectQuestion,
  'free-type': FreeTypeQuestion,
}

export function getQuestionComponent(
  type: string
): ComponentType<QuestionComponentProps<any>> {
  const component = questionRegistry[type]
  if (!component) {
    throw new Error(
      `No question component registered for type "${type}". Add it to questionRegistry.ts.`
    )
  }
  return component
}
