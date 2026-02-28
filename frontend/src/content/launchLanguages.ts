export interface LaunchLanguage {
  code: string
  name: string
  status: string
  detail: string
}

export const launchLanguages: LaunchLanguage[] = [
  {
    code: 'de',
    name: 'German',
    status: 'Go live',
    detail: 'Core launch language with the deepest initial grammar and vocabulary pack coverage.',
  },
  {
    code: 'es',
    name: 'Spanish',
    status: 'Go live',
    detail: 'Included in the launch scope for focused practice and early content rollout.',
  },
  {
    code: 'fr',
    name: 'French',
    status: 'Go live',
    detail: 'Included in the launch scope for early learner sessions and follow-up pack expansion.',
  },
]
