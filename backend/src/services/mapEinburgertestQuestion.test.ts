import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { mapEinburgertestQuestion, type EinburgertestQuestion } from './mapEinburgertestQuestion'

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

  test('maps image.descriptionDe to media.alt with a null url, for image questions without a sourced override', () => {
    const imageQuestions = questions.filter((q) => q.image)
    expect(imageQuestions).toHaveLength(13)

    // 6 of the 13 image questions (Q21, Q209, Q216, plus the 7 ids overridden below minus overlap)
    // have a real sourced image/optionImages override applied instead of the null-url placeholder.
    const overriddenIds = new Set([
      'c1868eed-f1a9-5888-be37-18c258108d0b', // Q55
      '0d2bf662-bd37-5461-91be-9fde1736955b', // Q187
      '8e603af2-612e-53ab-af7f-d5c8b5c1f79f', // Q226
      '4225242c-26f6-5416-a2b5-30a7c9cdcdc5', // Q1 bavaria
      'ea438848-5946-5e26-9525-1b0268458641', // Q8 bavaria
    ])

    for (const question of imageQuestions) {
      if (overriddenIds.has(question.id)) continue
      const result = mapEinburgertestQuestion(question)
      expect(result.media).toEqual({ kind: 'image', url: null, alt: question.image!.descriptionDe })
    }
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

  test('Q216 (Bundestag plenary hall eagle) has no override — excluded for unresolved sculpture copyright', () => {
    const question = questions.find((q) => q.id === '8cc3f9fa-dab7-51eb-a4c7-9035245a3f91')
    if (!question) throw new Error('fixture assumption failed: expected Q216 to exist in the catalog')

    const result = mapEinburgertestQuestion(question)

    expect(result.media).toEqual({ kind: 'image', url: null, alt: question.image!.descriptionDe })
    expect(result.optionImages).toBeUndefined()
  })
})
