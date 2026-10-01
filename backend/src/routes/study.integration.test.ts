import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { answer, backdateAnswers, cleanup, createDeck, createUser, db } from '../test/integration'

afterEach(cleanup)
afterAll(() => db.end())

describe('GET /api/study/today (real database)', () => {
  test('starts from the defaults with nothing studied', async () => {
    const user = await createUser()
    const response = await user.get('/api/study/today?tz=Europe/Berlin')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      dailyReviewLimit: 200,
      dailyNewLimit: 20,
      reviewedToday: 0,
      newToday: 0,
      reviewsRemaining: 200,
      newRemaining: 20,
    })
    expect(response.body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('counts first-time answers as new and earlier-seen questions as reviews, once each', async () => {
    const user = await createUser()
    const { exerciseIds } = await createDeck(user, [{ topic: 'a' }, { topic: 'a' }, { topic: 'a' }])
    await answer(user, exerciseIds[0])
    await backdateAnswers(user, 3) // q0 was first seen days ago
    await answer(user, exerciseIds[0]) // ...and reviewed today, twice
    await answer(user, exerciseIds[0], false)
    await answer(user, exerciseIds[1]) // new today
    await user.post('/api/progress').send({ exercise_id: exerciseIds[2], correct: true, mode: 'exam' }) // exams don't count

    const response = await user.get('/api/study/today')
    expect(response.body).toMatchObject({ reviewedToday: 1, newToday: 1, reviewsRemaining: 199, newRemaining: 19 })
  })

  test('uses saved limits and never goes below zero remaining', async () => {
    const user = await createUser()
    const { exerciseIds } = await createDeck(user, [{ topic: 'a' }, { topic: 'a' }])
    const saved = await user.put('/api/study/settings').send({ dailyReviewLimit: 50, dailyNewLimit: 1 })
    expect(saved.status).toBe(200)
    for (const id of exerciseIds) await answer(user, id)

    const response = await user.get('/api/study/today')
    expect(response.body).toMatchObject({ dailyReviewLimit: 50, dailyNewLimit: 1, newToday: 2, newRemaining: 0 })
  })

  test('rejects bad input', async () => {
    const user = await createUser()
    expect((await user.get('/api/study/today?tz=Not/A_Zone')).status).toBe(400)
    expect((await user.get('/api/study/today?tz=;drop')).status).toBe(400)
    expect((await user.put('/api/study/settings').send({ dailyReviewLimit: -1, dailyNewLimit: 5 })).status).toBe(400)
  })
})
