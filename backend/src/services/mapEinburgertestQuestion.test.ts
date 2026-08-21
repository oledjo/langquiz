import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import {
  mapEinburgertestQuestion,
  splitImageDescriptionByOption,
  type EinburgertestQuestion,
} from './mapEinburgertestQuestion'

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

  // Ids of the questions whose real pictures are vendored under backend/data/images/einburgertest.
  const sourcedIds = new Set([
    'c1868eed-f1a9-5888-be37-18c258108d0b', // Q55
    '0d2bf662-bd37-5461-91be-9fde1736955b', // Q187
    '4e2a23f3-9e9a-55c1-aff9-429f782d803c', // Q130
    '8e603af2-612e-53ab-af7f-d5c8b5c1f79f', // Q226
    '4225242c-26f6-5416-a2b5-30a7c9cdcdc5', // Q1 bavaria
    'ea438848-5946-5e26-9525-1b0268458641', // Q8 bavaria
  ])

  // The picker questions still waiting on pictures: their answer labels ("Bild 1", "1") carry no
  // information, so the per-option descriptions are what makes them answerable at all.
  const unsourcedPickerIds = new Set([
    '44b1b626-2428-51ba-8e36-8bb2fb87418e', // Q21 — federal coat of arms
    '33b3039e-694c-5cc1-a1b7-000aff6a8fd2', // Q209 — DDR coat of arms
  ])

  test('every image question ends up either illustrated or described — none is left unanswerable', () => {
    const imageQuestions = questions.filter((q) => q.image)
    expect(imageQuestions).toHaveLength(13)

    for (const question of imageQuestions) {
      const result = mapEinburgertestQuestion(question)
      const described = result.optionImages ?? (result.media ? [result.media] : [])

      expect(described.length).toBeGreaterThan(0)
      for (const image of described) {
        // Either a real picture, or text describing what the picture would show.
        expect(image.url ?? image.alt).toBeTruthy()
      }
    }
  })

  test('keeps the whole description as a single media placeholder when the options are not pictures', () => {
    const imageQuestions = questions.filter(
      (q) => q.image && !sourcedIds.has(q.id) && !unsourcedPickerIds.has(q.id)
    )
    expect(imageQuestions).toHaveLength(5)

    for (const question of imageQuestions) {
      const result = mapEinburgertestQuestion(question)
      expect(result.media).toEqual({ kind: 'image', url: null, alt: question.image!.descriptionDe })
      expect(result.optionImages).toBeUndefined()
    }
  })

  test('splits the description per option for an unsourced picker question (Q21)', () => {
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

  test('Q55 (Reichstag building) gets a single sourced media image with a real url and attribution', () => {
    const question = questions.find((q) => q.id === 'c1868eed-f1a9-5888-be37-18c258108d0b')
    if (!question) throw new Error('fixture assumption failed: expected Q55 to exist in the catalog')

    const result = mapEinburgertestQuestion(question)

    expect(result.media).toBeDefined()
    expect(result.media?.kind).toBe('image')
    expect(result.media?.url).toBe('/static/images/einburgertest/q55-reichstag-building.jpg')
    expect(result.media?.attribution).toBeTruthy()
    expect(result.optionImages).toBeUndefined()
  })

  test('Q226 (EU flag question) gets 4 optionImages instead of media, one per answer option', () => {
    const question = questions.find((q) => q.id === '8e603af2-612e-53ab-af7f-d5c8b5c1f79f')
    if (!question) throw new Error('fixture assumption failed: expected Q226 to exist in the catalog')

    const result = mapEinburgertestQuestion(question)

    expect(result.media).toBeUndefined()
    expect(result.optionImages).toHaveLength(4)
    expect(result.optionImages).toHaveLength(question.answersDe.length)
    for (const img of result.optionImages!) {
      expect(img.kind).toBe('image')
      expect(img.url).toMatch(/^\/static\/images\/einburgertest\//)
      expect(img.alt).toBeTruthy()
    }
  })

  test('Q130 (valid ballot paper) gets one drawn ballot per option', () => {
    const question = questions.find((q) => q.id === '4e2a23f3-9e9a-55c1-aff9-429f782d803c')
    if (!question) throw new Error('fixture assumption failed: expected Q130 to exist in the catalog')

    const result = mapEinburgertestQuestion(question)

    expect(result.media).toBeUndefined()
    expect(result.optionImages).toHaveLength(4)
    expect(result.optionImages?.map((image) => image.url)).toEqual([
      '/static/images/einburgertest/q130-stimmzettel-1.svg',
      '/static/images/einburgertest/q130-stimmzettel-2.svg',
      '/static/images/einburgertest/q130-stimmzettel-3.svg',
      '/static/images/einburgertest/q130-stimmzettel-4.svg',
    ])
  })

  test('every image a question points at exists on disk', () => {
    const referenced = questions
      .flatMap((question) => {
        const result = mapEinburgertestQuestion(question)
        return [...(result.optionImages ?? []), ...(result.media ? [result.media] : [])]
      })
      .map((image) => image.url)
      .filter((url): url is string => url !== null)

    expect(referenced.length).toBeGreaterThan(0)
    for (const url of referenced) {
      // Mounted by backend/src/index.ts as express.static at /static/images.
      const file = path.resolve(__dirname, '../../data/images', url.replace('/static/images/', ''))
      expect(fs.existsSync(file), `missing image file for ${url}`).toBe(true)
    }
  })

  test('Q216 (Bundestag plenary hall eagle) has no override — excluded for unresolved sculpture copyright', () => {
    const question = questions.find((q) => q.id === '8cc3f9fa-dab7-51eb-a4c7-9035245a3f91')
    if (!question) throw new Error('fixture assumption failed: expected Q216 to exist in the catalog')

    const result = mapEinburgertestQuestion(question)

    expect(result.media).toEqual({ kind: 'image', url: null, alt: question.image!.descriptionDe })
    expect(result.optionImages).toBeUndefined()
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
