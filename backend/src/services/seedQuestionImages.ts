import fs from 'fs'
import path from 'path'
import { db } from '../db/database'
import { normalizeContentType, parseImageSlot, slotToOptionIndex, upsertQuestionImage } from './questionImages'

export interface QuestionImageManifestEntry {
  exerciseId: string
  file: string
  slot: string
  contentType: string
  alt: string
  attribution?: string
  /**
   * Marks a sheet whose embedded photograph (or, for question 216, sculpture) belongs to a third
   * party rather than being covered by the BAMF sheet's own § 5 Abs. 1 UrhG status. Carried so the
   * affected entries can be found and pulled in one edit; the seeder does not act on it.
   */
  thirdPartyContent?: boolean
}

export interface SeedQuestionImagesResult {
  upserted: number
  removed: number
  skipped: number
}

export function manifestPath(): string {
  return path.resolve(__dirname, '../../data/question-images.json')
}

export function imagesDir(): string {
  return path.resolve(__dirname, '../../data/images/einburgertest')
}

export function readQuestionImageManifest(): QuestionImageManifestEntry[] {
  const parsed = JSON.parse(fs.readFileSync(manifestPath(), 'utf-8')) as {
    images?: QuestionImageManifestEntry[]
  }
  return parsed.images ?? []
}

/**
 * Loads the artwork that ships with the repository (backend/data/question-images.json plus the
 * files it names) into the `question_images` table.
 *
 * Runs on every boot as a content seed, so adding a picture is a commit rather than an operator
 * running a script against production by hand. Two rules keep that safe:
 *
 * - **A human upload always wins.** Rows with `source = 'admin'` came from someone in /admin
 *   deciding what a question should show; the seeder skips those slots entirely.
 * - **Removing an entry removes the image.** Rows the seeder owns that the manifest no longer
 *   lists are deleted, so git stays the source of truth for seeded artwork in both directions.
 */
export async function seedQuestionImages(): Promise<SeedQuestionImagesResult> {
  const entries = readQuestionImageManifest()
  const dir = imagesDir()

  const existing = await db.query<{ exercise_id: string; option_index: number | null; source: string }>(
    'SELECT exercise_id, option_index, source FROM question_images'
  )
  const sourceBySlot = new Map(
    existing.rows.map((row) => [`${row.exercise_id}#${row.option_index ?? 'question'}`, row.source])
  )

  let upserted = 0
  let skipped = 0
  const seededKeys = new Set<string>()

  for (const entry of entries) {
    const slot = parseImageSlot(entry.slot)
    if (!slot) throw new Error(`Manifest entry for ${entry.file} has an invalid slot "${entry.slot}".`)

    const contentType = normalizeContentType(entry.contentType)
    if (!contentType) {
      throw new Error(`Manifest entry for ${entry.file} has an unsupported content type "${entry.contentType}".`)
    }

    const filePath = path.join(dir, entry.file)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Manifest names ${entry.file}, which does not exist in ${dir}.`)
    }

    const key = `${entry.exerciseId}#${slotToOptionIndex(slot) ?? 'question'}`
    seededKeys.add(key)

    if (sourceBySlot.get(key) === 'admin') {
      skipped += 1
      continue
    }

    await upsertQuestionImage({
      exerciseId: entry.exerciseId,
      slot,
      bytes: fs.readFileSync(filePath),
      contentType,
      alt: entry.alt,
      attribution: entry.attribution ?? null,
      uploadedBy: null,
      source: 'seed',
    })
    upserted += 1
  }

  let removed = 0
  for (const row of existing.rows) {
    if (row.source !== 'seed') continue
    const key = `${row.exercise_id}#${row.option_index ?? 'question'}`
    if (seededKeys.has(key)) continue

    await db.query(
      `DELETE FROM question_images
        WHERE exercise_id = $1 AND option_index IS NOT DISTINCT FROM $2 AND source = 'seed'`,
      [row.exercise_id, row.option_index]
    )
    removed += 1
  }

  return { upserted, removed, skipped }
}
