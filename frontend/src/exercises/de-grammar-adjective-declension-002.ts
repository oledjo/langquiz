import type { Exercise } from '../types/exercise'

type DeclensionTemplate = {
  idBase: string
  declension: 'weak' | 'mixed' | 'strong'
  caseLabel: 'nominative' | 'accusative' | 'dative' | 'genitive'
  genderLabel: 'masculine' | 'feminine' | 'neuter'
  before: string
  after: string
  ending: '-e' | '-en' | '-er' | '-es' | '-em'
  difficulty: 1 | 2 | 3 | 4 | 5
}

const adjectiveStems = ['alt', 'jung', 'klein', 'neu', 'freundlich'] as const

const templates: DeclensionTemplate[] = [
  {
    idBase: 'weak-nom-masc',
    declension: 'weak',
    caseLabel: 'nominative',
    genderLabel: 'masculine',
    before: 'Der ',
    after: '___ Mann wartet.',
    ending: '-e',
    difficulty: 1,
  },
  {
    idBase: 'weak-nom-fem',
    declension: 'weak',
    caseLabel: 'nominative',
    genderLabel: 'feminine',
    before: 'Die ',
    after: '___ Frau liest.',
    ending: '-e',
    difficulty: 1,
  },
  {
    idBase: 'weak-nom-neut',
    declension: 'weak',
    caseLabel: 'nominative',
    genderLabel: 'neuter',
    before: 'Das ',
    after: '___ Kind spielt.',
    ending: '-e',
    difficulty: 1,
  },
  {
    idBase: 'weak-acc-masc',
    declension: 'weak',
    caseLabel: 'accusative',
    genderLabel: 'masculine',
    before: 'Ich sehe den ',
    after: '___ Hund.',
    ending: '-en',
    difficulty: 2,
  },
  {
    idBase: 'weak-dat-masc',
    declension: 'weak',
    caseLabel: 'dative',
    genderLabel: 'masculine',
    before: 'Er hilft dem ',
    after: '___ Lehrer.',
    ending: '-en',
    difficulty: 2,
  },
  {
    idBase: 'weak-dat-fem',
    declension: 'weak',
    caseLabel: 'dative',
    genderLabel: 'feminine',
    before: 'Wir danken der ',
    after: '___ Mutter.',
    ending: '-en',
    difficulty: 2,
  },
  {
    idBase: 'weak-dat-neut',
    declension: 'weak',
    caseLabel: 'dative',
    genderLabel: 'neuter',
    before: 'Sie hilft dem ',
    after: '___ Kind.',
    ending: '-en',
    difficulty: 2,
  },
  {
    idBase: 'weak-gen-masc',
    declension: 'weak',
    caseLabel: 'genitive',
    genderLabel: 'masculine',
    before: 'Wegen des ',
    after: '___ Mannes bleiben wir zu Hause.',
    ending: '-en',
    difficulty: 3,
  },
  {
    idBase: 'mixed-nom-masc',
    declension: 'mixed',
    caseLabel: 'nominative',
    genderLabel: 'masculine',
    before: 'Ein ',
    after: '___ Mann kommt.',
    ending: '-er',
    difficulty: 3,
  },
  {
    idBase: 'mixed-nom-neut',
    declension: 'mixed',
    caseLabel: 'nominative',
    genderLabel: 'neuter',
    before: 'Ein ',
    after: '___ Kind lacht.',
    ending: '-es',
    difficulty: 3,
  },
  {
    idBase: 'mixed-nom-fem',
    declension: 'mixed',
    caseLabel: 'nominative',
    genderLabel: 'feminine',
    before: 'Eine ',
    after: '___ Frau singt.',
    ending: '-e',
    difficulty: 3,
  },
  {
    idBase: 'mixed-acc-masc',
    declension: 'mixed',
    caseLabel: 'accusative',
    genderLabel: 'masculine',
    before: 'Ich kaufe einen ',
    after: '___ Mantel.',
    ending: '-en',
    difficulty: 3,
  },
  {
    idBase: 'mixed-dat-masc',
    declension: 'mixed',
    caseLabel: 'dative',
    genderLabel: 'masculine',
    before: 'Wir sprechen mit einem ',
    after: '___ Mann.',
    ending: '-en',
    difficulty: 4,
  },
  {
    idBase: 'mixed-gen-neut',
    declension: 'mixed',
    caseLabel: 'genitive',
    genderLabel: 'neuter',
    before: 'Die Farbe eines ',
    after: '___ Hauses ist blau.',
    ending: '-en',
    difficulty: 4,
  },
  {
    idBase: 'strong-nom-masc',
    declension: 'strong',
    caseLabel: 'nominative',
    genderLabel: 'masculine',
    before: '',
    after: '___ Wein schmeckt gut.',
    ending: '-er',
    difficulty: 4,
  },
  {
    idBase: 'strong-nom-fem',
    declension: 'strong',
    caseLabel: 'nominative',
    genderLabel: 'feminine',
    before: '',
    after: '___ Suppe ist heiß.',
    ending: '-e',
    difficulty: 4,
  },
  {
    idBase: 'strong-nom-neut',
    declension: 'strong',
    caseLabel: 'nominative',
    genderLabel: 'neuter',
    before: '',
    after: '___ Brot ist frisch.',
    ending: '-es',
    difficulty: 4,
  },
  {
    idBase: 'strong-acc-masc',
    declension: 'strong',
    caseLabel: 'accusative',
    genderLabel: 'masculine',
    before: 'Ich trinke ',
    after: '___ Kaffee.',
    ending: '-en',
    difficulty: 5,
  },
  {
    idBase: 'strong-dat-neut',
    declension: 'strong',
    caseLabel: 'dative',
    genderLabel: 'neuter',
    before: 'Mit ',
    after: '___ Brot schmeckt die Suppe besser.',
    ending: '-em',
    difficulty: 5,
  },
  {
    idBase: 'strong-gen-fem',
    declension: 'strong',
    caseLabel: 'genitive',
    genderLabel: 'feminine',
    before: 'Wegen ',
    after: '___ Hitze bleiben wir im Schatten.',
    ending: '-er',
    difficulty: 5,
  },
]

const optionsByEnding: Record<DeclensionTemplate['ending'], string[]> = {
  '-e': ['-e', '-en', '-er', '-es'],
  '-en': ['-en', '-e', '-er', '-es'],
  '-er': ['-er', '-e', '-en', '-es'],
  '-es': ['-es', '-e', '-en', '-er'],
  '-em': ['-em', '-en', '-er', '-es'],
}

const exercises: Exercise[] = templates.flatMap((template) =>
  adjectiveStems.map((stem, stemIndex) => {
    const options = optionsByEnding[template.ending]
    return {
      id: `de-grammar-adj-extra-${template.idBase}-${stemIndex + 1}`,
      type: 'selection',
      topic: 'adjective declension',
      subtopic: 'adjective-declension',
      language: 'de',
      difficulty: template.difficulty,
      prompt: `Choose the correct adjective ending. (${template.declension} declension — ${template.caseLabel} ${template.genderLabel})`,
      context: `${template.before}${stem}___${template.after}`,
      options,
      answer: options.indexOf(template.ending),
      explanation: `Correct ending is ${template.ending} for ${template.declension} declension in ${template.caseLabel} ${template.genderLabel}.`,
      tags: [
        'adjectives',
        `${template.declension}-declension`,
        template.caseLabel,
        template.genderLabel,
        'bulk-generated',
      ],
    }
  })
)

export default exercises
