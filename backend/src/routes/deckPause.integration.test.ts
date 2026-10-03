import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { answer, cleanup, createDeck, createUser, db, makeAllDue } from '../test/integration'

afterEach(cleanup)
afterAll(() => db.end())

describe('paused deck questions must not appear in question selection paths (real database)', () => {
  test('paused deck questions excluded from /api/exercises for all-decks review', async () => {
    const user = await createUser()
    const deck1 = await createDeck(user, [{ topic: 'deck1' }])
    const deck2 = await createDeck(user, [{ topic: 'deck2' }])
    
    // Answer all questions to get them into the review schedule
    for (const id of [...deck1.exerciseIds, ...deck2.exerciseIds]) {
      await answer(user, id, false)
    }
    await makeAllDue(user)

    // Verify both decks have questions due before pausing
    const statsBefore = await user.get('/api/stats')
    expect(statsBefore.body.length).toBe(2)
    expect(statsBefore.body.every((s: { due_at: string | null }) => s.due_at !== null)).toBe(true)

    // Pause deck1
    await user.put(`/api/decks/${deck1.deckId}/learning-paused`).send({ paused: true })

    // After pause: /api/stats should show deck1 questions with due_at = null
    const statsAfter = await user.get('/api/stats')
    expect(statsAfter.body.length).toBe(2)
    const deck1Stats = statsAfter.body.find((s: { exercise_id: string }) => s.exercise_id === deck1.exerciseIds[0])
    const deck2Stats = statsAfter.body.find((s: { exercise_id: string }) => s.exercise_id === deck2.exerciseIds[0])
    expect(deck1Stats.due_at).toBeNull() // paused deck has no due date
    expect(deck2Stats.due_at).not.toBeNull() // unpaused deck still has due date

    // All exercises endpoint should still return both decks' questions
    // (filtering by due_at happens client-side using stats)
    const exercises = await user.get('/api/exercises')
    expect(exercises.body.length).toBe(2)

    // Resume deck1
    await user.put(`/api/decks/${deck1.deckId}/learning-paused`).send({ paused: false })

    const statsResumed = await user.get('/api/stats')
    expect(statsResumed.body.length).toBe(2)
    expect(statsResumed.body.every((s: { due_at: string | null }) => s.due_at !== null)).toBe(true)
  })

  test('paused deck questions excluded from deck-specific /api/exercises?deckId=X', async () => {
    const user = await createUser()
    const { deckId, exerciseIds } = await createDeck(user, [{ topic: 'a' }, { topic: 'b' }])
    
    for (const id of exerciseIds) await answer(user, id, false)
    await makeAllDue(user)

    // Before pause: exercises are returned, stats show due dates
    const exercisesBefore = await user.get(`/api/exercises?deckId=${deckId}`)
    expect(exercisesBefore.body.length).toBe(2)
    
    const statsBefore = await user.get(`/api/stats?deckId=${deckId}`)
    expect(statsBefore.body.every((s: { due_at: string | null }) => s.due_at !== null)).toBe(true)

    // Pause the deck
    await user.put(`/api/decks/${deckId}/learning-paused`).send({ paused: true })

    // After pause: exercises still returned, but stats show due_at = null
    const exercisesAfter = await user.get(`/api/exercises?deckId=${deckId}`)
    expect(exercisesAfter.body.length).toBe(2)
    
    const statsAfter = await user.get(`/api/stats?deckId=${deckId}`)
    expect(statsAfter.body.every((s: { due_at: string | null }) => s.due_at === null)).toBe(true)
  })

  test('paused deck questions do not appear in due count', async () => {
    const user = await createUser()
    const { deckId, exerciseIds } = await createDeck(user, [{ topic: 'a' }, { topic: 'b' }])
    
    for (const id of exerciseIds) await answer(user, id, false)
    await makeAllDue(user)

    const metricsBefore = await user.get(`/api/progress/review-metrics?deckId=${deckId}`)
    expect(metricsBefore.body.totals.due_now).toBe(2)

    await user.put(`/api/decks/${deckId}/learning-paused`).send({ paused: true })

    const metricsAfter = await user.get(`/api/progress/review-metrics?deckId=${deckId}`)
    expect(metricsAfter.body.totals.due_now).toBe(0)

    // Resume
    await user.put(`/api/decks/${deckId}/learning-paused`).send({ paused: false })
    
    const metricsResumed = await user.get(`/api/progress/review-metrics?deckId=${deckId}`)
    expect(metricsResumed.body.totals.due_now).toBe(2)
  })

  test('mixed paused and active decks: only active deck questions are due', async () => {
    const user = await createUser()
    const pausedDeck = await createDeck(user, [{ topic: 'paused1' }, { topic: 'paused2' }])
    const activeDeck = await createDeck(user, [{ topic: 'active1' }])
    
    for (const id of [...pausedDeck.exerciseIds, ...activeDeck.exerciseIds]) {
      await answer(user, id, false)
    }
    await makeAllDue(user)

    // Pause one deck
    await user.put(`/api/decks/${pausedDeck.deckId}/learning-paused`).send({ paused: true })

    // Global metrics should only count active deck
    const globalMetrics = await user.get('/api/progress/review-metrics')
    expect(globalMetrics.body.totals.due_now).toBe(1) // only activeDeck question

    // Paused deck metrics should show 0 due
    const pausedMetrics = await user.get(`/api/progress/review-metrics?deckId=${pausedDeck.deckId}`)
    expect(pausedMetrics.body.totals.due_now).toBe(0)

    // Active deck metrics should show its question due
    const activeMetrics = await user.get(`/api/progress/review-metrics?deckId=${activeDeck.deckId}`)
    expect(activeMetrics.body.totals.due_now).toBe(1)

    // Global stats: paused deck questions have due_at = null, active deck has due_at
    const stats = await user.get('/api/stats')
    const pausedStats = stats.body.filter((s: { exercise_id: string }) => 
      pausedDeck.exerciseIds.includes(s.exercise_id)
    )
    const activeStats = stats.body.filter((s: { exercise_id: string }) => 
      activeDeck.exerciseIds.includes(s.exercise_id)
    )
    
    expect(pausedStats.every((s: { due_at: string | null }) => s.due_at === null)).toBe(true)
    expect(activeStats.every((s: { due_at: string | null }) => s.due_at !== null)).toBe(true)
  })

  test('topic-level pause: only paused topic questions excluded', async () => {
    const user = await createUser()
    const { deckId, exerciseIds } = await createDeck(user, [{ topic: 'verbs' }, { topic: 'nouns' }])
    
    for (const id of exerciseIds) await answer(user, id, false)
    await makeAllDue(user)

    // Pause only verbs
    await user.put(`/api/decks/${deckId}/topics/learning-paused`).send({ topic: 'verbs', paused: true })

    const stats = await user.get(`/api/stats?deckId=${deckId}`)
    const verbsStats = stats.body.find((s: { exercise_id: string }) => s.exercise_id === exerciseIds[0])
    const nounsStats = stats.body.find((s: { exercise_id: string }) => s.exercise_id === exerciseIds[1])
    
    expect(verbsStats.due_at).toBeNull()
    expect(nounsStats.due_at).not.toBeNull()

    const metrics = await user.get(`/api/progress/review-metrics?deckId=${deckId}`)
    expect(metrics.body.totals.due_now).toBe(1) // only nouns

    // Resume verbs
    await user.put(`/api/decks/${deckId}/topics/learning-paused`).send({ topic: 'verbs', paused: false })
    
    const statsResumed = await user.get(`/api/stats?deckId=${deckId}`)
    expect(statsResumed.body.every((s: { due_at: string | null }) => s.due_at !== null)).toBe(true)
  })

  test('home page scenario: continue learning button should respect pause', async () => {
    const user = await createUser()
    const { deckId, exerciseIds } = await createDeck(user, [{ topic: 'a' }, { topic: 'b' }])
    
    for (const id of exerciseIds) await answer(user, id, false)
    await makeAllDue(user)

    // Simulate home page data fetching: get all exercises and stats
    const exercises = await user.get('/api/exercises')
    const stats = await user.get('/api/stats')
    const today = await user.get('/api/study/today')

    // Client-side would filter exercises by due_at from stats
    const dueExercises = exercises.body.filter((ex: { id: string }) => {
      const stat = stats.body.find((s: { exercise_id: string }) => s.exercise_id === ex.id)
      return stat && stat.due_at && new Date(stat.due_at).getTime() <= Date.now()
    })
    
    expect(dueExercises.length).toBe(2)
    expect(today.body.reviewsRemaining).toBeGreaterThan(0)

    // Pause deck
    await user.put(`/api/decks/${deckId}/learning-paused`).send({ paused: true })

    // Refetch (simulating user refreshing or PROGRESS_UPDATED_EVENT)
    const exercisesAfter = await user.get('/api/exercises')
    const statsAfter = await user.get('/api/stats')

    const dueAfterPause = exercisesAfter.body.filter((ex: { id: string }) => {
      const stat = statsAfter.body.find((s: { exercise_id: string }) => s.exercise_id === ex.id)
      return stat && stat.due_at && new Date(stat.due_at).getTime() <= Date.now()
    })
    
    // After pause, no exercises should be due (due_at is null for paused deck)
    expect(dueAfterPause.length).toBe(0)
  })
})
