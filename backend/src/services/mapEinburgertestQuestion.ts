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

export interface MappedExerciseImage {
  kind: 'image'
  url: string | null
  alt: string
  attribution?: string
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
  media?: MappedExerciseImage
  // One image per answer option, parallel to `options` — used instead of `media` for questions
  // where each option IS an image (heraldry/flag/map picks) rather than the question having a
  // single illustrative image. See EINBURGERTEST_MEDIA_OVERRIDES below.
  optionImages?: MappedExerciseImage[]
}

// Base path for statically-served, freely-licensed images vendored under
// backend/data/images/einburgertest (see backend/src/index.ts's express.static mount at
// /static/images). Frontend code prepends its own API base URL to this path at render time.
const IMG = '/static/images/einburgertest'

// Hardcoded overrides keyed by the source question's unique `id` (NOT officialQuestionNumber,
// which collides between the 'general' and 'bavaria' scopes). Each entry supplies either a
// single `media` image (question has one illustrative photo/graphic) or `optionImages` (each
// answer option is itself an image — heraldry/flag/map picker questions). Every image here was
// manually sourced from Wikimedia Commons and verified to carry a free license (CC0, public
// domain, or CC-BY-SA with attribution) before being vendored into the repo — see the commit
// message / PR description for the full source-and-license audit trail.
const EINBURGERTEST_MEDIA_OVERRIDES: Record<
  string,
  { media?: MappedExerciseImage } | { optionImages: MappedExerciseImage[] }
> = {
  // Q55 (general): Reichstag building exterior, glass dome visible.
  'c1868eed-f1a9-5888-be37-18c258108d0b': {
    media: {
      kind: 'image',
      url: `${IMG}/q55-reichstag-building.jpg`,
      alt: 'Reichstagsgebäude in Berlin bei Sonnenuntergang, mit gläserner Kuppel auf dem Dach',
      attribution: 'Jürgen Matern / Wikimedia Commons, CC BY-SA 3.0',
    },
  },
  // Q187 (general): flag of the DDR (black-red-gold with hammer, compass, wreath emblem).
  '0d2bf662-bd37-5461-91be-9fde1736955b': {
    media: {
      kind: 'image',
      url: `${IMG}/q187-ddr-flag.svg`,
      alt: 'Flagge der DDR: schwarz-rot-gold mit Hammer, Zirkel und Ährenkranz',
      attribution: 'Public domain (official German government work, § 5 Abs. 1 UrhG)',
    },
  },
  // Q21 (general) and Q209 (general) share the same 4 heraldic option images: 1) German federal
  // eagle (Bundesadler), 2) DDR emblem's exact opposite distractor — kept unset because the two
  // remaining official BAMF distractor graphics (a Chi-Rho-style monogram and an unidentified
  // grey/white/blue cross) could not be matched with confidence to a real, freely-licensed
  // Commons image without risking misattribution. Per the hard sourcing constraint, both
  // questions are excluded rather than shipped with 2 of 4 options unillustrated.
  //
  // Q226 (general): 4 flags — USA, EU, UN, NATO (confirmed against the real official BAMF
  // question 226 answer set, matching this catalog's image description closely enough to be
  // confident despite an imprecise auto-generated descriptionDe for the NATO compass-rose emblem).
  '8e603af2-612e-53ab-af7f-d5c8b5c1f79f': {
    optionImages: [
      {
        kind: 'image',
        url: `${IMG}/q226-us-flag.svg`,
        alt: 'Flagge der Vereinigten Staaten von Amerika: 13 rote und weiße Streifen, blaues Rechteck mit 50 weißen Sternen',
      },
      {
        kind: 'image',
        url: `${IMG}/q226-eu-flag.svg`,
        alt: 'Flagge der Europäischen Union: Kreis aus zwölf goldenen Sternen auf dunkelblauem Grund',
      },
      {
        kind: 'image',
        url: `${IMG}/q226-un-flag.svg`,
        alt: 'Flagge der Vereinten Nationen: weiße Weltkarte umrahmt von Olivenzweigen auf hellblauem Grund',
      },
      {
        kind: 'image',
        url: `${IMG}/q226-nato-flag.svg`,
        alt: 'Flagge der NATO: weiße Kompassrose auf dunkelblauem Grund',
      },
    ],
  },
  // Q1 (bavaria): 4 state coats of arms — Baden-Württemberg, Bayern (correct), Sachsen-Anhalt,
  // Mecklenburg-Vorpommern — identified by matching each option's heraldic description in the
  // catalog against the real blazon of each state's arms.
  '4225242c-26f6-5416-a2b5-30a7c9cdcdc5': {
    optionImages: [
      {
        kind: 'image',
        url: `${IMG}/q1-bavaria-coa-baden-wuerttemberg.svg`,
        alt: 'Wappen von Baden-Württemberg: drei schwarze Löwen auf goldenem Schild mit Krone',
        attribution: 'Public domain (official German government work, § 5 Abs. 1 UrhG)',
      },
      {
        kind: 'image',
        url: `${IMG}/q1-bavaria-coa-bayern.svg`,
        alt: 'Wappen von Bayern: weiß-blaue Rauten mit goldener Krone',
        attribution: 'Public domain (official German government work, § 5 Abs. 1 UrhG)',
      },
      {
        kind: 'image',
        url: `${IMG}/q1-bavaria-coa-sachsen-anhalt.svg`,
        alt: 'Wappen von Sachsen-Anhalt: schwarz-goldene Streifen mit grünem Rautenkranz und Adler oben, schwarzer Bär auf roter Zinnenmauer unten',
        attribution: 'Public domain (official German government work, § 5 Abs. 1 UrhG)',
      },
      {
        kind: 'image',
        url: `${IMG}/q1-bavaria-coa-mecklenburg-vorpommern.svg`,
        alt: 'Wappen von Mecklenburg-Vorpommern: gold gekrönter schwarzer Stierkopf und roter Greif',
        attribution: 'Public domain (official German government work, § 5 Abs. 1 UrhG)',
      },
    ],
  },
  // Q8 (bavaria): 4 highlighted maps of Germany's 16 states, each derived from the same CC0 base
  // map (Map Germany Länder-de.svg, Wikimedia Commons), highlighting Hessen, Baden-Württemberg,
  // Thüringen, and Bayern (correct) respectively, matched to the catalog's position/border-count
  // description for each option.
  'ea438848-5946-5e26-9525-1b0268458641': {
    optionImages: [
      {
        kind: 'image',
        url: `${IMG}/q8-bavaria-map-hessen.svg`,
        alt: 'Karte Deutschlands mit hervorgehobenem Bundesland Hessen',
        attribution: 'Base map: Patricia.fidi / Wikimedia Commons, CC0 (derived, states recolored)',
      },
      {
        kind: 'image',
        url: `${IMG}/q8-bavaria-map-baden-wuerttemberg.svg`,
        alt: 'Karte Deutschlands mit hervorgehobenem Bundesland Baden-Württemberg',
        attribution: 'Base map: Patricia.fidi / Wikimedia Commons, CC0 (derived, states recolored)',
      },
      {
        kind: 'image',
        url: `${IMG}/q8-bavaria-map-thueringen.svg`,
        alt: 'Karte Deutschlands mit hervorgehobenem Bundesland Thüringen',
        attribution: 'Base map: Patricia.fidi / Wikimedia Commons, CC0 (derived, states recolored)',
      },
      {
        kind: 'image',
        url: `${IMG}/q8-bavaria-map-bayern.svg`,
        alt: 'Karte Deutschlands mit hervorgehobenem Bundesland Bayern',
        attribution: 'Base map: Patricia.fidi / Wikimedia Commons, CC0 (derived, states recolored)',
      },
    ],
  },
}

export function mapEinburgertestQuestion(question: EinburgertestQuestion): MappedExercise {
  const base: MappedExercise = {
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

  const override = EINBURGERTEST_MEDIA_OVERRIDES[question.id]
  if (!override) return base

  if ('optionImages' in override) {
    // optionImages replaces the placeholder text-only `media` entry entirely — the question is
    // rendered as an image picker, not a single-image-plus-text-options question.
    const withoutMedia: MappedExercise = { ...base }
    delete withoutMedia.media
    return { ...withoutMedia, optionImages: override.optionImages }
  }
  return { ...base, ...(override.media ? { media: override.media } : {}) }
}
