import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { answer, cleanup, createDeck, createUser, db, makeAllDue } from '../test/integration'

afterEach(cleanup)
afterAll(() => db.end())

describe('stopping learning a deck (real database)', () => {
  test('its questions stop being due everywhere, statistics stay, resuming brings them back', async () => {
    const user = await createUser()
    const { deckId, slug, exerciseIds } = await createDeck(user, [{ topic: 'a' }, { topic: 'b' }])
    for (const id of exerciseIds) await answer(user, id, false)
    await makeAllDue(user)

    const dueBefore = await user.get(`/api/progress/review-metrics?deckId=${deckId}`)
    expect(dueBefore.body.totals.due_now).toBe(2)

    const pause = await user.put(`/api/decks/${deckId}/learning-paused`).send({ paused: true })
    expect(pause.status).toBe(200)

    const stats = await user.get(`/api/stats?deckId=${deckId}`)
    expect(stats.body).toHaveLength(2)
    expect(stats.body.every((row: { due_at: string | null; total_attempts: number }) => row.due_at === null && row.total_attempts === 1)).toBe(true)
    const single = await user.get(`/api/stats/${exerciseIds[0]}`)
    expect(single.body.due_at).toBeNull()
    expect((await user.get(`/api/progress/review-metrics?deckId=${deckId}`)).body.totals.due_now).toBe(0)
    expect((await user.get(`/api/progress/statistics?deckId=${deckId}`)).body.futureDue.backlog).toBe(0)
    const schedule = await user.get(`/api/progress/schedule?deckId=${deckId}`)
    expect(schedule.body.rows.map((row: { learningPaused: boolean }) => row.learningPaused)).toEqual([true, true])
    expect((await user.get(`/api/decks/${slug}`)).body.learningPaused).toBe(true)

    await user.put(`/api/decks/${deckId}/learning-paused`).send({ paused: false })
    expect((await user.get(`/api/progress/review-metrics?deckId=${deckId}`)).body.totals.due_now).toBe(2)
    expect((await user.get(`/api/decks/${slug}`)).body.learningPaused).toBeUndefined()
  })

  test("one user's pause does not affect another user", async () => {
    const owner = await createUser()
    const { deckId } = await createDeck(owner, [{ topic: 'a' }])
    const other = await createUser()

    const response = await other.put(`/api/decks/${deckId}/learning-paused`).send({ paused: true })
    expect(response.status).toBe(404) // a private deck of someone else
    const paused = await db.query('SELECT 1 FROM user_paused_decks WHERE deck_id = $1', [deckId])
    expect(paused.rowCount).toBe(0)
  })
})

describe('stopping learning one topic (real database)', () => {
  test('only that topic leaves the review queue; the deck reports it as paused', async () => {
    const user = await createUser()
    const { deckId, slug, exerciseIds } = await createDeck(user, [{ topic: 'verbs' }, { topic: 'nouns' }])
    for (const id of exerciseIds) await answer(user, id, false)
    await makeAllDue(user)

    const pause = await user.put(`/api/decks/${deckId}/topics/learning-paused`).send({ topic: 'verbs', paused: true })
    expect(pause.status).toBe(200)

    const stats = await user.get(`/api/stats?deckId=${deckId}`)
    const dueById = Object.fromEntries(stats.body.map((row: { exercise_id: string; due_at: string | null }) => [row.exercise_id, row.due_at]))
    expect(dueById[exerciseIds[0]]).toBeNull()
    expect(dueById[exerciseIds[1]]).not.toBeNull()
    expect((await user.get(`/api/progress/review-metrics?deckId=${deckId}`)).body.totals.due_now).toBe(1)
    expect((await user.get(`/api/decks/${slug}`)).body.pausedTopics).toEqual(['verbs'])

    await user.put(`/api/decks/${deckId}/topics/learning-paused`).send({ topic: 'verbs', paused: false })
    expect((await user.get(`/api/progress/review-metrics?deckId=${deckId}`)).body.totals.due_now).toBe(2)
    expect((await user.get(`/api/decks/${slug}`)).body.pausedTopics).toBeUndefined()
  })

  test('rejects a missing topic', async () => {
    const user = await createUser()
    const { deckId } = await createDeck(user, [{ topic: 'a' }])
    const response = await user.put(`/api/decks/${deckId}/topics/learning-paused`).send({ paused: true })
    expect(response.status).toBe(400)
  })
})
