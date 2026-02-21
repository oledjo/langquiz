import { Router } from 'express'
import { db } from '../db/database'

export const statsRouter = Router()

statsRouter.get('/', async (_req, res) => {
  try {
    const result = await db.query(
      'SELECT exercise_id, total_attempts, correct_attempts, last_answered FROM exercise_stats ORDER BY last_answered DESC NULLS LAST'
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
      'SELECT exercise_id, total_attempts, correct_attempts, last_answered FROM exercise_stats WHERE exercise_id = $1',
      [req.params.exerciseId]
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
