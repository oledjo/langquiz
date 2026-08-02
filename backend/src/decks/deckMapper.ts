/**
 * Shape of a row from the `decks` table (see migration 012_decks.sql). Matches
 * what `pg` returns for a `SELECT * FROM decks` query.
 */
export interface DeckRow {
  id: number
  slug: string
  title: string
  description: string
  origin: 'official' | 'community'
  owner_id: number | null
  study_modes: string[]
  facet_definitions: unknown
  locales: string[]
  exam_config: unknown
  answer_rule_id: string | null
}

/**
 * JSON shape returned by the deck API. Field-for-field match with the frontend's
 * `Deck` type in frontend/src/types/deck.ts, except `id`/`ownerId` are strings
 * here (see this plan's "ID convention" note) where the DB stores them as
 * BIGINT to match every other table's primary key convention.
 */
export interface DeckDto {
  id: string
  slug: string
  title: string
  description: string
  origin: 'official' | 'community'
  ownerId?: string
  studyModes: string[]
  facetDefinitions: unknown
  locales: string[]
  examConfig?: unknown
  answerRuleId?: string
}

export function mapDeckRow(row: DeckRow): DeckDto {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    description: row.description,
    origin: row.origin,
    ownerId: row.owner_id === null ? undefined : String(row.owner_id),
    studyModes: row.study_modes,
    facetDefinitions: row.facet_definitions,
    locales: row.locales,
    examConfig: row.exam_config === null ? undefined : row.exam_config,
    answerRuleId: row.answer_rule_id === null ? undefined : row.answer_rule_id,
  }
}
