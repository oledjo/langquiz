import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { db } from '../db/database'
import { signToken } from '../auth/jwt'
import { app } from '../index'

export { db }

export interface TestUser {
  id: number
  token: string
  /** supertest agent with this user's Authorization header pre-set. */
  get(path: string): request.Test
  put(path: string): request.Test
  post(path: string): request.Test
}

const createdUsers: number[] = []
const createdDecks: number[] = []

export async function createUser(): Promise<TestUser> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, 'integration-test') RETURNING id`,
    [`it-${randomUUID()}@example.test`]
  )
  const id = Number(result.rows[0].id)
  createdUsers.push(id)
  const token = signToken(id, 'user')
  const auth = (test: request.Test) => test.set('Authorization', `Bearer ${token}`)
  return {
    id,
    token,
    get: (path) => auth(request(app).get(path)),
    put: (path) => auth(request(app).put(path)),
    post: (path) => auth(request(app).post(path)),
  }
}

export interface TestQuestion {
  topic: string
  id?: string
}

/**
 * A private deck owned by `user` with one selection question per entry. Returns the deck id and
 * the question ids, in order.
 */
export async function createDeck(
  user: TestUser,
  questions: TestQuestion[]
): Promise<{ deckId: number; slug: string; exerciseIds: string[] }> {
  const slug = `it-deck-${randomUUID()}`
  const deck = await db.query<{ id: string }>(
    `INSERT INTO decks (slug, title, origin, owner_id, is_private) VALUES ($1, $1, 'community', $2, TRUE) RETURNING id`,
    [slug, user.id]
  )
  const deckId = Number(deck.rows[0].id)
  createdDecks.push(deckId)
  const exerciseIds: string[] = []
  for (const question of questions) {
    const exerciseId = question.id ?? `it-q-${randomUUID()}`
    exerciseIds.push(exerciseId)
    await db.query(
      `INSERT INTO user_exercises (user_id, exercise_id, data, deck_id) VALUES ($1, $2, $3, $4)`,
      [
        user.id,
        exerciseId,
        JSON.stringify({
          id: exerciseId,
          type: 'selection',
          topic: question.topic,
          subtopic: 's',
          language: 'de',
          difficulty: 1,
          prompt: 'Pick one',
          options: ['a', 'b'],
          answer: 0,
        }),
        deckId,
      ]
    )
  }
  return { deckId, slug, exerciseIds }
}

/** Records an answer through the real API, as a client would. */
export async function answer(user: TestUser, exerciseId: string, correct = true): Promise<void> {
  const response = await user.post('/api/progress').send({ exercise_id: exerciseId, correct })
  if (response.status !== 201) throw new Error(`POST /api/progress failed: ${response.status} ${JSON.stringify(response.body)}`)
}

/** Makes every scheduled question of `user` due `daysAgo` days ago. */
export async function makeAllDue(user: TestUser, daysAgo = 1): Promise<void> {
  await db.query(`UPDATE user_review_schedule SET due_at = NOW() - make_interval(days => $2) WHERE user_id = $1`, [user.id, daysAgo])
}

/** Moves all of `user`'s answers `days` days into the past (answers "from earlier"). */
export async function backdateAnswers(user: TestUser, days: number): Promise<void> {
  await db.query(`UPDATE progress SET answered_at = answered_at - make_interval(days => $2) WHERE user_id = $1`, [user.id, days])
}

export async function cleanup(): Promise<void> {
  if (createdDecks.length > 0) {
    await db.query(`DELETE FROM decks WHERE id = ANY($1::BIGINT[])`, [createdDecks.splice(0)])
  }
  if (createdUsers.length > 0) {
    const ids = createdUsers.splice(0)
    await db.query(`DELETE FROM progress WHERE user_id = ANY($1::BIGINT[])`, [ids])
    await db.query(`DELETE FROM users WHERE id = ANY($1::BIGINT[])`, [ids])
  }
}
