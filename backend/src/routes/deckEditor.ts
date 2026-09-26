/**
 * Editing a user's own decks: create/rename/delete a private deck, add/edit/delete its questions,
 * and draft questions with AI. Questions live in `user_exercises` with `deck_id` set, so the
 * existing GET /api/exercises?deckId=… and study flows pick them up unchanged.
 */
import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { Router, type Request, type Response } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { basicBotGuard, rateLimit } from '../middleware/security'
import { mapDeckRow, type DeckRow } from '../decks/deckMapper'
import { normalizeExerciseInput, slugifyDeckTitle, type StoredExercise } from '../services/exerciseInput'
import {
  generateDeckExercises,
  GenerationError,
  MAX_GENERATED,
  MAX_SOURCE_TEXT,
  MAX_TOPIC,
} from '../services/deckGeneration'

export const MAX_TITLE = 120
export const MAX_DESCRIPTION = 1000
export const MAX_QUESTIONS_PER_REQUEST = 100
export const MAX_QUESTIONS_PER_DECK = 5000

export const deckEditorRouter = Router()

deckEditorRouter.use(requireAuth, basicBotGuard, rateLimit({ keyPrefix: 'deck-editor', windowMs: 60_000, max: 120, perUser: true }))

let anthropicClient: Anthropic | null | undefined

/** The Claude client, or null when ANTHROPIC_API_KEY is not configured. */
function getAnthropicClient(): Anthropic | null {
  if (anthropicClient === undefined) {
    anthropicClient = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null
  }
  return anthropicClient
}

/** Test hook: inject a fake client (or null to simulate a missing key). */
export function setAnthropicClientForTests(client: Anthropic | null | undefined): void {
  anthropicClient = client
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Loads a deck only when the caller owns it; sends 404 and returns null otherwise. */
async function loadOwnDeck(req: Request, res: Response): Promise<DeckRow | null> {
  const deckId = Number(req.params.deckId)
  if (!Number.isSafeInteger(deckId) || deckId <= 0) {
    res.status(404).json({ error: 'Deck not found.' })
    return null
  }
  const result = await db.query<DeckRow>('SELECT * FROM decks WHERE id = $1 AND owner_id = $2', [deckId, req.userId])
  const deck = result.rows[0]
  if (!deck) {
    res.status(404).json({ error: 'Deck not found.' })
    return null
  }
  return deck
}

function deckDefaults(deck: DeckRow): { topic: string; language: string } {
  return { topic: deck.title, language: deck.locales[0] ?? '' }
}

function toQuestionDto(exerciseId: string, data: StoredExercise | Record<string, unknown>, deckId: number) {
  return { ...data, id: exerciseId, deckId: String(deckId), isUserAdded: true }
}

function newExerciseId(deckId: number): string {
  return `deck-${deckId}-${randomUUID().slice(0, 8)}`
}

function handleError(res: Response, action: string, error: unknown): void {
  console.error(`Failed to ${action}:`, error)
  res.status(500).json({ error: `Failed to ${action}.` })
}

deckEditorRouter.post('/', async (req, res) => {
  const title = text(req.body?.title)
  const description = text(req.body?.description)
  const language = text(req.body?.language).slice(0, 10)
  if (!title) {
    res.status(400).json({ error: 'A deck needs a title.' })
    return
  }
  if (title.length > MAX_TITLE || description.length > MAX_DESCRIPTION) {
    res.status(400).json({ error: `Title must be at most ${MAX_TITLE} and description ${MAX_DESCRIPTION} characters.` })
    return
  }
  try {
    const slug = `${slugifyDeckTitle(title)}-${randomUUID().slice(0, 6)}`
    const result = await db.query<DeckRow>(
      `INSERT INTO decks (slug, title, description, origin, owner_id, is_private, study_modes, facet_definitions, locales)
       VALUES ($1, $2, $3, 'community', $4, TRUE, ARRAY['practice']::TEXT[], '[]'::JSONB, $5::TEXT[])
       RETURNING *`,
      [slug, title, description, req.userId, language ? [language] : []],
    )
    res.status(201).json(mapDeckRow(result.rows[0]))
  } catch (error) {
    handleError(res, 'create deck', error)
  }
})

deckEditorRouter.patch('/:deckId', async (req, res) => {
  try {
    const deck = await loadOwnDeck(req, res)
    if (!deck) return
    const title = req.body?.title === undefined ? deck.title : text(req.body.title)
    const description = req.body?.description === undefined ? deck.description : text(req.body.description)
    if (!title || title.length > MAX_TITLE || description.length > MAX_DESCRIPTION) {
      res.status(400).json({ error: `Title is required (max ${MAX_TITLE}); description max ${MAX_DESCRIPTION} characters.` })
      return
    }
    const result = await db.query<DeckRow>(
      'UPDATE decks SET title = $1, description = $2, updated_at = NOW() WHERE id = $3 AND owner_id = $4 RETURNING *',
      [title, description, deck.id, req.userId],
    )
    res.json(mapDeckRow(result.rows[0]))
  } catch (error) {
    handleError(res, 'update deck', error)
  }
})

deckEditorRouter.delete('/:deckId', async (req, res) => {
  try {
    const deck = await loadOwnDeck(req, res)
    if (!deck) return
    await db.query('DELETE FROM user_exercises WHERE user_id = $1 AND deck_id = $2', [req.userId, deck.id])
    await db.query('DELETE FROM decks WHERE id = $1 AND owner_id = $2', [deck.id, req.userId])
    res.status(204).end()
  } catch (error) {
    handleError(res, 'delete deck', error)
  }
})

deckEditorRouter.get('/:deckId/questions', async (req, res) => {
  try {
    const deck = await loadOwnDeck(req, res)
    if (!deck) return
    const result = await db.query<{ exercise_id: string; data: Record<string, unknown> }>(
      'SELECT exercise_id, data FROM user_exercises WHERE user_id = $1 AND deck_id = $2 ORDER BY created_at ASC, id ASC',
      [req.userId, deck.id],
    )
    res.json({ deck: mapDeckRow(deck), questions: result.rows.map((row) => toQuestionDto(row.exercise_id, row.data, deck.id)) })
  } catch (error) {
    handleError(res, 'load questions', error)
  }
})

deckEditorRouter.post('/:deckId/questions', async (req, res) => {
  const raw = req.body?.questions
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_QUESTIONS_PER_REQUEST) {
    res.status(400).json({ error: `Send 1–${MAX_QUESTIONS_PER_REQUEST} questions.` })
    return
  }
  try {
    const deck = await loadOwnDeck(req, res)
    if (!deck) return

    const exercises: StoredExercise[] = []
    for (const [index, item] of raw.entries()) {
      const result = normalizeExerciseInput(item, deckDefaults(deck))
      if ('error' in result) {
        res.status(400).json({ error: `Question ${index + 1}: ${result.error}`, index })
        return
      }
      exercises.push(result.exercise)
    }

    const countResult = await db.query<{ count: number }>(
      'SELECT COUNT(*)::INT AS count FROM user_exercises WHERE user_id = $1 AND deck_id = $2',
      [req.userId, deck.id],
    )
    if ((countResult.rows[0]?.count ?? 0) + exercises.length > MAX_QUESTIONS_PER_DECK) {
      res.status(400).json({ error: `A deck can hold at most ${MAX_QUESTIONS_PER_DECK} questions.` })
      return
    }

    const created = []
    for (const exercise of exercises) {
      const exerciseId = newExerciseId(deck.id)
      const data = { ...exercise, id: exerciseId }
      await db.query('INSERT INTO user_exercises (user_id, exercise_id, data, deck_id) VALUES ($1, $2, $3, $4)', [
        req.userId,
        exerciseId,
        data,
        deck.id,
      ])
      created.push(toQuestionDto(exerciseId, data, deck.id))
    }
    await db.query('UPDATE decks SET updated_at = NOW() WHERE id = $1', [deck.id])
    res.status(201).json({ questions: created })
  } catch (error) {
    handleError(res, 'add questions', error)
  }
})

deckEditorRouter.put('/:deckId/questions/:exerciseId', async (req, res) => {
  try {
    const deck = await loadOwnDeck(req, res)
    if (!deck) return
    const result = normalizeExerciseInput(req.body, deckDefaults(deck))
    if ('error' in result) {
      res.status(400).json({ error: result.error })
      return
    }
    const exerciseId = String(req.params.exerciseId)
    const data = { ...result.exercise, id: exerciseId }
    const updated = await db.query(
      'UPDATE user_exercises SET data = $1 WHERE user_id = $2 AND deck_id = $3 AND exercise_id = $4 RETURNING exercise_id',
      [data, req.userId, deck.id, exerciseId],
    )
    if (updated.rowCount === 0) {
      res.status(404).json({ error: 'Question not found.' })
      return
    }
    res.json(toQuestionDto(exerciseId, data, deck.id))
  } catch (error) {
    handleError(res, 'update question', error)
  }
})

deckEditorRouter.delete('/:deckId/questions/:exerciseId', async (req, res) => {
  try {
    const deck = await loadOwnDeck(req, res)
    if (!deck) return
    const deleted = await db.query('DELETE FROM user_exercises WHERE user_id = $1 AND deck_id = $2 AND exercise_id = $3', [
      req.userId,
      deck.id,
      String(req.params.exerciseId),
    ])
    if (deleted.rowCount === 0) {
      res.status(404).json({ error: 'Question not found.' })
      return
    }
    res.status(204).end()
  } catch (error) {
    handleError(res, 'delete question', error)
  }
})

deckEditorRouter.post(
  '/:deckId/generate',
  rateLimit({ keyPrefix: 'deck-generate', windowMs: 60 * 60_000, max: 10, perUser: true }),
  async (req, res) => {
    const topic = text(req.body?.topic)
    const sourceText = text(req.body?.sourceText)
    const language = text(req.body?.language).slice(0, 30)
    const count = Number(req.body?.count ?? 10)
    if (!topic && !sourceText) {
      res.status(400).json({ error: 'Describe a topic or paste some text to generate from.' })
      return
    }
    if (topic.length > MAX_TOPIC || sourceText.length > MAX_SOURCE_TEXT) {
      res.status(400).json({ error: `Topic max ${MAX_TOPIC} characters; text max ${MAX_SOURCE_TEXT} characters.` })
      return
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATED) {
      res.status(400).json({ error: `Ask for 1–${MAX_GENERATED} questions.` })
      return
    }

    const client = getAnthropicClient()
    if (!client) {
      res.status(503).json({ error: 'AI generation is not configured on this server.' })
      return
    }

    try {
      const deck = await loadOwnDeck(req, res)
      if (!deck) return
      const { exercises, dropped } = await generateDeckExercises(
        client,
        { topic: topic || undefined, sourceText: sourceText || undefined, count, language: language || undefined, deckTitle: deck.title },
        deckDefaults(deck),
      )
      res.json({ questions: exercises, dropped })
    } catch (error) {
      if (error instanceof GenerationError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      handleError(res, 'generate questions', error)
    }
  },
)
