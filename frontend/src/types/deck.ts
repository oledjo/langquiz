export type StudyMode = 'practice' | 'exam'

const STUDY_MODES: readonly StudyMode[] = ['practice', 'exam']

export function isStudyMode(value: string): value is StudyMode {
  return (STUDY_MODES as readonly string[]).includes(value)
}

export type LocaleCode = string // e.g. 'ru', 'en'

export type DeckOrigin = 'official' | 'community'

export interface FacetDefinition {
  key: string // e.g. 'level'
  label: string // e.g. 'CEFR level'
  values: string[] // e.g. ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
}

export interface FacetQuota {
  facetKey: string
  facetValue: string
  count: number
}

export interface ExamConfig {
  questionCount: number
  passingScore: number
  quotas: FacetQuota[]
  timeLimitMinutes?: number
}

export type AnswerRuleId = 'german-articles'

export interface Deck {
  id: string
  slug: string
  title: string
  description: string
  origin: DeckOrigin
  ownerId?: string
  studyModes: StudyMode[]
  facetDefinitions: FacetDefinition[]
  locales: LocaleCode[]
  examConfig?: ExamConfig
  answerRuleId?: AnswerRuleId
}

export interface QuestionMedia {
  kind: 'image'
  url: string | null // null when only a text description is available
  alt: string
  attribution?: string
}

export interface ExerciseTranslation {
  prompt: string
  options?: string[]
  explanation?: string
}
