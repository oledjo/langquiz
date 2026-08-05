export interface EinburgertestQuestionImage {
  path: string | null
  descriptionDe: string
  attribution: string | null
}

export interface EinburgertestQuestion {
  id: string
  officialQuestionNumber: number
  scope: 'general' | 'bavaria'
  promptDe: string
  answersDe: string[]
  correctAnswerIndex: number
  image: EinburgertestQuestionImage | null
  promptRu: string
  answersRu: string[]
  explanationRu: string
  explanationSourceUrl: string
  sourceUrl: string
  sourceVersion: string
  reviewStatus: string
  reviewedAt: string | null
}

export interface MappedExercise {
  id: string
  type: 'selection'
  topic: string
  subtopic: string
  language: string
  difficulty: 3
  prompt: string
  options: string[]
  answer: number
  explanation: string
  facets: { scope: string }
  translations: { ru: { prompt: string; options: string[] } }
  media?: { kind: 'image'; url: null; alt: string }
}

export function mapEinburgertestQuestion(question: EinburgertestQuestion): MappedExercise {
  return {
    id: question.id,
    type: 'selection',
    topic: 'einbuergerungstest',
    subtopic: question.scope,
    language: 'de',
    difficulty: 3,
    prompt: question.promptDe,
    options: question.answersDe,
    answer: question.correctAnswerIndex,
    explanation: question.explanationRu,
    facets: { scope: question.scope },
    translations: {
      ru: {
        prompt: question.promptRu,
        options: question.answersRu,
      },
    },
    ...(question.image ? { media: { kind: 'image' as const, url: null, alt: question.image.descriptionDe } } : {}),
  }
}
