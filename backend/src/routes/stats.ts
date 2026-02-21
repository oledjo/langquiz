import { Router } from 'express'
import { db } from '../db/database'

export const statsRouter = Router()

statsRouter.get('/', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM exercise_stats ORDER BY last_answered DESC')
    .all()
  res.json(rows)
})

statsRouter.get('/:exerciseId', (req, res) => {
  const row = db
    .prepare('SELECT * FROM exercise_stats WHERE exercise_id = ?')
    .get(req.params.exerciseId)

  res.json(
    row ?? {
      exercise_id: req.params.exerciseId,
      total_attempts: 0,
      correct_attempts: 0,
      last_answered: null,
    }
  )
})
