import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'

export const statsRouter = Router()

statsRouter.use(requireAuth)

statsRouter.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT exercise_id, total_attempts, correct_attempts, last_answered FROM exercise_stats WHERE user_id = $1 ORDER BY last_answered DESC NULLS LAST',
      [req.userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})

statsRouter.get('/:exerciseId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT exercise_id, total_attempts, correct_attempts, last_answered FROM exercise_stats WHERE user_id = $1 AND exercise_id = $2',
      [req.userId, req.params.exerciseId]
    )

    res.json(
      result.rows[0] ?? {
        exercise_id: req.params.exerciseId,
        total_attempts: 0,
        correct_attempts: 0,
        last_answered: null,
      }
    )
  } catch (error) {
    console.error('Failed to fetch exercise stats:', error)
    res.status(500).json({ error: 'Failed to load exercise stats' })
  }
})
