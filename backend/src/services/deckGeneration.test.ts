import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, test, vi } from 'vitest'
import { buildGenerationPrompt, draftToExercises, generateDeckExercises, GenerationError, type GeneratedDraft } from './deckGeneration'

const defaults = { topic: 'Space', language: 'en' }
const request = { topic: 'Solar system', count: 3, deckTitle: 'Planets' }

function fakeClient(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response)
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse }
}

const draft: GeneratedDraft = {
  exercises: [
    { type: 'selection', prompt: 'Largest planet?', options: ['Mars', 'Jupiter', 'Venus'], correct_indices: [1], accepted_answers: [], explanation: 'By mass and size.' },
    { type: 'multiselect', prompt: 'Gas giants?', options: ['Jupiter', 'Saturn', 'Earth'], correct_indices: [0, 1], accepted_answers: [], explanation: '' },
    { type: 'free-type', prompt: 'Closest planet to the Sun?', options: [], correct_indices: [], accepted_answers: ['Mercury'], explanation: '' },
    { type: 'selection', prompt: 'Broken: two answers', options: ['a', 'b'], correct_indices: [0, 1], accepted_answers: [], explanation: '' },
  ],
}

describe('draftToExercises', () => {
  test('maps each type and drops invalid candidates', () => {
    const { exercises, dropped } = draftToExercises(draft, defaults)
    expect(dropped).toBe(1)
    expect(exercises.map((e) => e.type)).toEqual(['selection', 'multiselect', 'free-type'])
    expect(exercises[0]).toMatchObject({ answer: 1, explanation: 'By mass and size.', topic: 'Space' })
    expect(exercises[1]).toMatchObject({ answers: [0, 1] })
    expect(exercises[2]).toMatchObject({ answers: ['Mercury'] })
  })
})

describe('buildGenerationPrompt', () => {
  test('wraps source text and names the language', () => {
    const prompt = buildGenerationPrompt({ ...request, sourceText: 'Pluto is a dwarf planet.', language: 'de' })
    expect(prompt).toContain('<source_text>\nPluto is a dwarf planet.\n</source_text>')
    expect(prompt).toContain('language: de')
    expect(prompt).toContain('Write 3 quiz questions')
  })
})

describe('generateDeckExercises', () => {
  test('calls Claude Opus 5 with server-side fallbacks and structured output', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: draft })
    const result = await generateDeckExercises(client, request, defaults)
    expect(result.exercises).toHaveLength(3)
    const params = parse.mock.calls[0][0]
    expect(params).toMatchObject({ model: 'claude-opus-5', fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] })
    expect(params.output_config.format).toBeDefined()
  })

  test('refusal becomes a 422', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', parsed_output: null })
    await expect(generateDeckExercises(client, request, defaults)).rejects.toMatchObject({ status: 422 })
  })

  test('missing parsed output becomes a 502', async () => {
    const { client } = fakeClient({ stop_reason: 'max_tokens', parsed_output: null })
    const error = await generateDeckExercises(client, request, defaults).catch((e) => e)
    expect(error).toBeInstanceOf(GenerationError)
    expect(error.status).toBe(502)
  })
})
