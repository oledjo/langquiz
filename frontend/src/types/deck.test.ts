import { describe, expect, test } from 'vitest'
import { isStudyMode } from './deck'

describe('isStudyMode', () => {
  test('accepts practice and exam', () => {
    expect(isStudyMode('practice')).toBe(true)
    expect(isStudyMode('exam')).toBe(true)
  })

  test('rejects anything else', () => {
    expect(isStudyMode('quiz')).toBe(false)
    expect(isStudyMode('')).toBe(false)
  })
})
