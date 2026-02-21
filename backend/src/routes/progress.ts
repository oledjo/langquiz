import { Router } from 'express'
import { db } from '../db/database'

export const progressRouter = Router()

progressRouter.post('/', (req, res) => {
  const { exercise_id, correct } = req.body as { exercise_id?: unknown; correct?: unknown }

  if (typeof exercise_id !== 'string' || typeof correct !== 'boolean') {
    res.status(400).json({ error: 'exercise_id (string) and correct (boolean) are required' })
    return
  }

  db.prepare('INSERT INTO progress (exercise_id, correct) VALUES (?, ?)').run(
    exercise_id,
    correct ? 1 : 0
  )

  res.status(201).json({ ok: true })
})

progressRouter.get('/:exerciseId', (req, res) => {
  const rows = db
    .prepare(
      'SELECT exercise_id, correct, answered_at FROM progress WHERE exercise_id = ? ORDER BY answered_at DESC'
    )
    .all(req.params.exerciseId)

  res.json(rows)
})
