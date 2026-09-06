import { describe, expect, test } from 'vitest'
import { computeContentVersion } from './contentVersion'

describe('computeContentVersion', () => {
  const rows = [
    {
      id: 1,
      slug: 'einburgertest',
      exercise_count: 310,
      max_updated: '2026-09-01T10:00:00.000Z',
      deck_updated: '2026-08-01T00:00:00.000Z',
    },
    {
      id: 2,
      slug: 'de-grammar',
      exercise_count: 40,
      max_updated: '2026-07-15T09:00:00.000Z',
      deck_updated: '2026-07-15T09:00:00.000Z',
    },
  ]

  test('produces one contentVersion per deck plus a global decksCursor', () => {
    const result = computeContentVersion(rows)
    expect(result.decks.map((d) => d.slug)).toEqual(['einburgertest', 'de-grammar'])
    expect(result.decks[0].contentVersion).toMatch(/^[a-f0-9]{16}$/)
    expect(result.decksCursor).toMatch(/^[a-f0-9]{16}$/)
  })

  test('is stable for identical input and changes when any deck timestamp or count changes', () => {
    const a = computeContentVersion(rows)
    const b = computeContentVersion(rows.map((r) => ({ ...r })))
    expect(a).toEqual(b)

    const bumped = computeContentVersion([
      { ...rows[0], max_updated: '2026-09-02T10:00:00.000Z' },
      rows[1],
    ])
    expect(bumped.decks[0].contentVersion).not.toBe(a.decks[0].contentVersion)
    expect(bumped.decksCursor).not.toBe(a.decksCursor)
  })

  test('handles a deck with zero exercises (max_updated null)', () => {
    const result = computeContentVersion([
      { id: 3, slug: 'empty', exercise_count: 0, max_updated: null, deck_updated: '2026-01-01T00:00:00.000Z' },
    ])
    expect(result.decks[0].contentVersion).toMatch(/^[a-f0-9]{16}$/)
  })
})
