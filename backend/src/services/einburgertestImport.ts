import fs from 'fs'
import path from 'path'
import { db } from '../db/database'
import { mapEinburgertestQuestion, type EinburgertestQuestion } from './mapEinburgertestQuestion'

export interface EinburgertestImportResult {
  deckId: number
  upserted: number
}

/**
 * Upserts the Einbürgerungstest deck and all 310 questions from the vendored snapshot
 * (backend/data/einburgertest-demo-catalog.json) directly into Postgres. Idempotent — re-running
 * updates matching rows in place rather than duplicating them. Shared by the CLI script
 * (backend/scripts/import-einburgertest.ts) and the admin-triggered HTTP endpoint
 * (POST /api/admin/decks/import-einburgertest), so both paths run identical logic.
 */
export async function importEinburgertestDeck(): Promise<EinburgertestImportResult> {
  const dataPath = path.resolve(__dirname, '../../data/einburgertest-demo-catalog.json')
  const questions: EinburgertestQuestion[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  const deckResult = await db.query<{ id: number }>(
    `INSERT INTO decks (slug, title, description, origin, study_modes, facet_definitions, locales, exam_config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       study_modes = EXCLUDED.study_modes,
       facet_definitions = EXCLUDED.facet_definitions,
       locales = EXCLUDED.locales,
       exam_config = EXCLUDED.exam_config,
       updated_at = NOW()
     RETURNING id`,
    [
      'einbuergerungstest',
      'Einbürgerungstest',
      'Practice the official German citizenship test question bank.',
      'official',
      ['practice', 'exam'],
      JSON.stringify([{ key: 'scope', label: 'Scope', values: ['general', 'bavaria'] }]),
      ['de', 'ru'],
      JSON.stringify({
        questionCount: 33,
        passingScore: 17,
        quotas: [
          { facetKey: 'scope', facetValue: 'general', count: 30 },
          { facetKey: 'scope', facetValue: 'bavaria', count: 3 },
        ],
      }),
    ]
  )
  const deckId = deckResult.rows[0].id

  let upserted = 0
  for (const question of questions) {
    const exercise = mapEinburgertestQuestion(question)
    await db.query(
      `INSERT INTO exercises (exercise_id, data, deck_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (exercise_id) DO UPDATE SET
         data = EXCLUDED.data,
         deck_id = EXCLUDED.deck_id,
         updated_at = NOW()`,
      [exercise.id, JSON.stringify(exercise), deckId]
    )
    upserted += 1
  }

  return { deckId, upserted }
}
