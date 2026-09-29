import { useState } from 'react'
import { shuffle } from './shuffle'

/**
 * A random display order for `length` answer options, as a list of original option indices.
 * Picked once per mount (question components are keyed by exercise id, so each question gets
 * a fresh order) and kept stable across re-renders, so options don't jump after answering.
 * Answers are still recorded by original index — only the on-screen order changes.
 */
export function useShuffledOrder(length: number, enabled = true): number[] {
  const [order] = useState(() => {
    const indices = Array.from({ length }, (_, i) => i)
    return enabled ? shuffle(indices) : indices
  })
  // Defensive: if the same instance is ever reused for a question with a different option
  // count, fall back to the natural order rather than dropping or duplicating options.
  return order.length === length ? order : Array.from({ length }, (_, i) => i)
}
