/// <reference types="node" />
import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import type { Exercise } from '../types/exercise'

/**
 * The packs in this directory are authored here but served from Postgres: they are exported to
 * `backend/data/bundled-exercises.json` (`backend/npm run export:exercises`) and loaded into the
 * database by `backend/npm run seed:exercises`. Nothing imports them at runtime any more.
 *
 * This test is the guard on that hand-off — editing a pack without regenerating the snapshot
 * would otherwise silently ship content that never reaches a learner. It is also the only place
 * left that reads the packs from the app, and it does so in a test, so they stay out of the
 * shipped bundle.
 */
const packs = import.meta.glob(['./*.ts', '!./*.test.ts'], { eager: true }) as Record<
  string,
  { default?: Exercise[] }
>

const SNAPSHOT_PATH = path.resolve(__dirname, '../../../backend/data/bundled-exercises.json')

function authoredExercises(): Exercise[] {
  return Object.entries(packs)
    .flatMap(([file, module]) => {
      const exercises = module.default
      if (!Array.isArray(exercises)) throw new Error(`${file} does not default-export an array.`)
      return exercises
    })
}

describe('bundled exercise packs', () => {
  const authored = authoredExercises()

  test('every exercise has a non-empty id, and no id is reused across packs', () => {
    const ids = authored.map((exercise) => exercise.id)
    expect(ids.every((id) => typeof id === 'string' && id.trim() !== '')).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('match the snapshot the backend seeds from', () => {
    const snapshot: Exercise[] = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'))

    const byId = (exercises: Exercise[]) =>
      Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]))

    // A mismatch means the packs changed without `npm run export:exercises` being re-run in
    // backend/ (and the regenerated JSON committed).
    expect(byId(snapshot)).toEqual(byId(authored))
  })
})
