import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useExerciseSession } from './useExerciseSession'
import type { Exercise } from '../types/exercise'
import * as progressApi from '../api/progressApi'

vi.mock('../auth/AuthContext', () => {
  const authValue = {
    user: { id: 1, email: 'test@example.com', role: 'user' as const },
    isGuest: false,
    isLoading: false,
    token: 'test-token',
    login: vi.fn(),
    register: vi.fn(),
    continueAsGuest: vi.fn(),
    logout: vi.fn(),
  }
  return { useAuth: () => authValue }
})

function makeExercise(id: string): Exercise {
  return {
    id,
    type: 'selection',
    topic: 'articles',
    subtopic: 'der',
    language: 'de',
    difficulty: 1,
    prompt: `Prompt ${id}`,
    options: ['der', 'die', 'das'],
    answer: 0,
  }
}

describe('useExerciseSession', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('keeps the list it started with when the caller re-derives a shorter one', async () => {
    vi.spyOn(progressApi, 'postResult').mockResolvedValue(undefined)
    const [a, b, c] = ['a', 'b', 'c'].map(makeExercise)

    const { result, rerender } = renderHook(({ exercises }) => useExerciseSession(exercises), {
      initialProps: { exercises: [a, b, c] },
    })

    expect(result.current.currentExercise?.id).toBe('a')

    await act(async () => {
      await result.current.handleComplete(a, { type: 'selection', selectedIndex: 0 }, { correct: true }, 'good')
      result.current.advance()
    })
    expect(result.current.currentExercise?.id).toBe('b')

    // What the untried-only and due-review pages do once the answer to `a` lands in the stats.
    rerender({ exercises: [b, c] })

    expect(result.current.currentExercise?.id).toBe('b')
    expect(result.current.exercises).toHaveLength(3)

    act(() => {
      result.current.advance()
    })
    expect(result.current.currentExercise?.id).toBe('c')
  })

  test('restart replays the session the user just did', () => {
    const exercises = ['a', 'b'].map(makeExercise)
    const { result, rerender } = renderHook(({ exercises }) => useExerciseSession(exercises), {
      initialProps: { exercises },
    })

    act(() => {
      result.current.advance()
      result.current.advance()
    })
    expect(result.current.isComplete).toBe(true)

    rerender({ exercises: [] })
    act(() => {
      result.current.restart()
    })

    expect(result.current.isComplete).toBe(false)
    expect(result.current.currentExercise?.id).toBe('a')
    expect(result.current.exercises).toHaveLength(2)
  })

  test('an empty session is not reported complete', () => {
    const { result } = renderHook(() => useExerciseSession([]))

    expect(result.current.isComplete).toBe(false)
    expect(result.current.currentExercise).toBeNull()
  })
})
