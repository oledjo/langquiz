import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { answer, cleanup, createDeck, createUser, db } from '../test/integration'

afterEach(cleanup)
afterAll(() => db.end())

describe('personal FSRS parameters (real database)', () => {
  test('refuses to optimize without enough history', async () => {
    const user = await createUser()
    const status = await user.get('/api/study/scheduler')
    expect(status.body).toMatchObject({ personalized: false, availableReviews: 0, requiredReviews: 400 })
    const response = await user.post('/api/study/scheduler/optimize')
    expect(response.status).toBe(422)
  })

  test('fits weights to a long history, stores them, and schedules with them', async () => {
    const user = await createUser()
    const { exerciseIds } = await createDeck(user, Array.from({ length: 100 }, () => ({ topic: 't' })))
    // 100 questions × 6 answers spread over months: 500 long-term reviews.
    await db.query(
      `INSERT INTO progress (exercise_id, correct, user_id, answer_grade, mode, answered_at)
       SELECT q.id, r.n % 5 <> 0, $1, CASE WHEN r.n % 5 = 0 THEN 'again' ELSE 'good' END, 'practice',
              NOW() - make_interval(days => 200 - r.n * (r.n + 3))
       FROM unnest($2::TEXT[]) AS q(id), generate_series(0, 5) AS r(n)`,
      [user.id, exerciseIds]
    )

    const before = await user.get('/api/study/scheduler')
    expect(before.body.availableReviews).toBe(500)

    const optimized = await user.post('/api/study/scheduler/optimize')
    expect(optimized.status).toBe(200)
    expect(optimized.body).toMatchObject({ status: 'optimized', reviewCount: 500 })

    const stored = await db.query<{ parameters: number[] }>('SELECT parameters FROM user_fsrs_parameters WHERE user_id = $1', [user.id])
    expect(stored.rows[0].parameters).toHaveLength(21)
    expect((await user.get('/api/study/scheduler')).body.personalized).toBe(true)

    // Answering still works with the personal scheduler in the loop.
    await answer(user, exerciseIds[0])
    const schedule = await db.query('SELECT due_at FROM user_review_schedule WHERE user_id = $1 AND exercise_id = $2', [user.id, exerciseIds[0]])
    expect(schedule.rows[0].due_at.getTime()).toBeGreaterThan(Date.now())
  })
})
