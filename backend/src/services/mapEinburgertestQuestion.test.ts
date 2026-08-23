import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import {
  mapEinburgertestQuestion,
  splitImageDescriptionByOption,
  type EinburgertestQuestion,
} from './mapEinburgertestQuestion'
import { imagesDir, readQuestionImageManifest } from './seedQuestionImages'
import { MAX_IMAGE_BYTES, normalizeContentType, parseImageSlot } from './questionImages'

const dataPath = path.resolve(__dirname, '../../data/einburgertest-demo-catalog.json')
const questions: EinburgertestQuestion[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

describe('vendored content snapshot', () => {
  test('has 310 questions: 300 general, 10 bavaria', () => {
    expect(questions).toHaveLength(310)
    expect(questions.filter((q) => q.scope === 'general')).toHaveLength(300)
    expect(questions.filter((q) => q.scope === 'bavaria')).toHaveLength(10)
  })
})

describe('mapEinburgertestQuestion', () => {
  test('maps a general question with no image', () => {
    const question = questions.find((q) => q.scope === 'general' && !q.image)
    if (!question) throw new Error('fixture assumption failed: expected a general question with no image')

    const result = mapEinburgertestQuestion(question)

    expect(result.id).toBe(question.id)
    expect(result.type).toBe('selection')
    expect(result.topic).toBe('einbuergerungstest')
    expect(result.subtopic).toBe('general')
    expect(result.language).toBe('de')
    expect(result.difficulty).toBe(3)
    expect(result.prompt).toBe(question.promptDe)
    expect(result.options).toEqual(question.answersDe)
    expect(result.answer).toBe(question.correctAnswerIndex)
    expect(result.explanation).toBe(question.explanationRu)
    expect(result.facets).toEqual({ scope: 'general' })
    expect(result.translations).toEqual({ ru: { prompt: question.promptRu, options: question.answersRu } })
    expect(result.media).toBeUndefined()
  })

  test('maps a bavaria question', () => {
    const question = questions.find((q) => q.scope === 'bavaria')
    if (!question) throw new Error('fixture assumption failed: expected at least one bavaria question')

    const result = mapEinburgertestQuestion(question)

    expect(result.subtopic).toBe('bavaria')
    expect(result.facets).toEqual({ scope: 'bavaria' })
  })

  // Picker questions: the options are pictures, so their labels ("Bild 1", "1") carry no
  // information on their own and the description has to be split per option to match.
  const pickerIds = new Set([
    '44b1b626-2428-51ba-8e36-8bb2fb87418e', // Q21 — federal coat of arms
    '4e2a23f3-9e9a-55c1-aff9-429f782d803c', // Q130 — valid ballot paper
    '33b3039e-694c-5cc1-a1b7-000aff6a8fd2', // Q209 — DDR coat of arms
    '8e603af2-612e-53ab-af7f-d5c8b5c1f79f', // Q226 — EU flag
    '4225242c-26f6-5416-a2b5-30a7c9cdcdc5', // Q1 bavaria — Bavarian coat of arms
    'ea438848-5946-5e26-9525-1b0268458641', // Q8 bavaria — which state is Bavaria
  ])

  test('every image question ends up described — none is left unanswerable', () => {
    const imageQuestions = questions.filter((q) => q.image)
    expect(imageQuestions).toHaveLength(13)

    for (const question of imageQuestions) {
      const result = mapEinburgertestQuestion(question)
      const described = result.optionImages ?? (result.media ? [result.media] : [])

      expect(described.length).toBeGreaterThan(0)
      for (const image of described) {
        expect(image.alt).toBeTruthy()
      }
    }
  })

  test('never emits a picture url — artwork comes from question_images, not the mapper', () => {
    for (const question of questions) {
      const result = mapEinburgertestQuestion(question)
      for (const image of [...(result.optionImages ?? []), ...(result.media ? [result.media] : [])]) {
        expect(image.url).toBeNull()
      }
    }
  })

  test('keeps the whole description as a single media placeholder when the options are not pictures', () => {
    const imageQuestions = questions.filter((q) => q.image && !pickerIds.has(q.id))
    expect(imageQuestions).toHaveLength(7)

    for (const question of imageQuestions) {
      const result = mapEinburgertestQuestion(question)
      expect(result.media).toEqual({ kind: 'image', url: null, alt: question.image!.descriptionDe })
      expect(result.optionImages).toBeUndefined()
    }
  })

  test('splits the description per option for a picker question (Q21)', () => {
    const question = questions.find((q) => q.id === '44b1b626-2428-51ba-8e36-8bb2fb87418e')
    if (!question) throw new Error('fixture assumption failed: expected Q21 to exist in the catalog')

    const result = mapEinburgertestQuestion(question)

    expect(result.optionImages).toHaveLength(4)
    expect(result.optionImages?.every((image) => image.url === null)).toBe(true)
    expect(result.optionImages?.[0].alt).toMatch(/^Das Wappen zeigt auf goldgelbem Grund einen schwarzen Adler/)
    expect(result.optionImages?.[3].alt).toMatch(/Hammer und ein Zirkel/)
    // Nothing is left over for a separate description block: the description was entirely
    // per-option text.
    expect(result.media).toBeUndefined()
  })

  test('a shared intro sentence stays out of the per-option split', () => {
    const split = splitImageDescriptionByOption(
      'Abgebildet ist eine Karte. 1. Erste Beschreibung mit genug Text. 2. Zweite Beschreibung mit genug Text.',
      ['1', '2']
    )

    expect(split?.intro).toBe('Abgebildet ist eine Karte.')
    expect(split?.optionDescriptions).toEqual([
      'Erste Beschreibung mit genug Text.',
      'Zweite Beschreibung mit genug Text.',
    ])
  })
})

describe('question artwork manifest', () => {
  const manifest = readQuestionImageManifest()

  test('covers every image question exactly once', () => {
    const imageQuestionIds = questions.filter((q) => q.image).map((q) => q.id)
    const manifestIds = manifest.map((entry) => entry.exerciseId)

    expect(new Set(manifestIds).size).toBe(manifestIds.length)
    expect([...manifestIds].sort()).toEqual([...imageQuestionIds].sort())
  })

  test('every entry names a file that exists and a question in the catalog', () => {
    expect(manifest.length).toBeGreaterThan(0)
    const catalogIds = new Set(questions.map((q) => q.id))

    for (const entry of manifest) {
      expect(catalogIds.has(entry.exerciseId), `unknown exerciseId ${entry.exerciseId}`).toBe(true)
      expect(fs.existsSync(path.join(imagesDir(), entry.file)), `missing ${entry.file}`).toBe(true)
      expect(normalizeContentType(entry.contentType), `bad content type on ${entry.file}`).not.toBeNull()
      expect(parseImageSlot(entry.slot), `bad slot on ${entry.file}`).not.toBeNull()
      expect(entry.alt.trim().length).toBeGreaterThan(0)
    }
  })

  test('every file is small enough to store', () => {
    for (const entry of manifest) {
      const { size } = fs.statSync(path.join(imagesDir(), entry.file))
      expect(size, `${entry.file} exceeds the ${MAX_IMAGE_BYTES} byte limit`).toBeLessThanOrEqual(MAX_IMAGE_BYTES)
    }
  })

  test('alt text is the question own official description', () => {
    for (const entry of manifest) {
      const question = questions.find((q) => q.id === entry.exerciseId)
      expect(entry.alt).toBe(question?.image?.descriptionDe)
    }
  })
})

describe('splitImageDescriptionByOption', () => {
  const fourParts =
    'Bild 1: Ein schwarzer Adler auf goldenem Grund. ' +
    'Bild 2: Zwei gekreuzte griechische Buchstaben. ' +
    'Bild 3: Ein graues Kreuz mit blauem Rahmen. ' +
    'Bild 4: Ein goldener Ährenkranz mit Hammer und Zirkel.'

  test('splits "Bild N:" segments for "Bild N" options', () => {
    const split = splitImageDescriptionByOption(fourParts, ['Bild 1', 'Bild 2', 'Bild 3', 'Bild 4'])

    expect(split?.optionDescriptions).toHaveLength(4)
    expect(split?.optionDescriptions[1]).toBe('Zwei gekreuzte griechische Buchstaben.')
    expect(split?.intro).toBe('')
  })

  test('splits "N." segments for numeric options', () => {
    const split = splitImageDescriptionByOption(
      '1. Der erste Stimmzettel ist korrekt ausgefüllt. 2. Der zweite Stimmzettel ist ungültig.',
      ['1', '2']
    )

    expect(split?.optionDescriptions).toEqual([
      'Der erste Stimmzettel ist korrekt ausgefüllt.',
      'Der zweite Stimmzettel ist ungültig.',
    ])
  })

  test('returns null when the options are answers rather than picture labels', () => {
    // Q176's image is one map with four numbered zones; its options name who held which zone, so
    // the numbered segments describe the picture, not the options.
    expect(
      splitImageDescriptionByOption('1. Nordwestliche Zone mit vielen Ländern. 2. Nordöstliche Zone mit Ländern.', [
        '1=Großbritannien, 2=Sowjetunion',
        '1=Sowjetunion, 2=Großbritannien',
      ])
    ).toBeNull()
  })

  test('returns null when a segment is missing', () => {
    expect(splitImageDescriptionByOption(fourParts, ['Bild 1', 'Bild 2', 'Bild 3', 'Bild 4', 'Bild 5'])).toBeNull()
  })

  test('returns null when the numbering is not in order', () => {
    expect(
      splitImageDescriptionByOption('2. Zweite Beschreibung mit Text. 1. Erste Beschreibung mit Text.', ['1', '2'])
    ).toBeNull()
  })

  test('returns null when a segment has no meaningful text', () => {
    expect(splitImageDescriptionByOption('Bild 1: kurz. Bild 2: auch kurz.', ['Bild 1', 'Bild 2'])).toBeNull()
  })
})
