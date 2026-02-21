import { Router } from 'express'
import { db } from '../db/database'

export const progressRouter = Router()

progressRouter.post('/', async (req, res) => {
  const { exercise_id, correct } = req.body as { exercise_id?: unknown; correct?: unknown }

  if (typeof exercise_id !== 'string' || typeof correct !== 'boolean') {
    res.status(400).json({ error: 'exercise_id (string) and correct (boolean) are required' })
    return
  }

  try {
    await db.query(
      'INSERT INTO progress (exercise_id, correct) VALUES ($1, $2)',
      [exercise_id, correct]
    )
  } catch (error) {
    console.error('Failed to insert progress row:', error)
    res.status(500).json({ error: 'Failed to save progress' })
    return
  }

  res.status(201).json({ ok: true })
})

progressRouter.get('/:exerciseId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT exercise_id, correct, answered_at FROM progress WHERE exercise_id = $1 ORDER BY answered_at DESC',
      [req.params.exerciseId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Failed to fetch progress rows:', error)
    res.status(500).json({ error: 'Failed to load progress' })
  }
})
