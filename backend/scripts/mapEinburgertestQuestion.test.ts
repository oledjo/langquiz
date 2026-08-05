import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { mapEinburgertestQuestion, type EinburgertestQuestion } from './mapEinburgertestQuestion'

const dataPath = path.resolve(__dirname, '../data/einburgertest-demo-catalog.json')
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

  test('maps image.descriptionDe to media.alt with a null url, for all 13 image questions', () => {
    const imageQuestions = questions.filter((q) => q.image)
    expect(imageQuestions).toHaveLength(13)

    for (const question of imageQuestions) {
      const result = mapEinburgertestQuestion(question)
      expect(result.media).toEqual({ kind: 'image', url: null, alt: question.image!.descriptionDe })
    }
  })
})
