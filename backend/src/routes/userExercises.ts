import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'

export const userExercisesRouter = Router()

userExercisesRouter.use(requireAuth)

userExercisesRouter.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT exercise_id, data, share_status
       FROM user_exercises
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.userId]
    )
    const exercises = result.rows.map(
      (row: { exercise_id: string; data: Record<string, unknown>; share_status: string }) => ({
        ...row.data,
        isUserAdded: true,
        shareStatus: row.share_status,
      })
    )
    res.json(exercises)
  } catch (error) {
    console.error('Failed to fetch user exercises:', error)
    res.status(500).json({ error: 'Failed to load exercises.' })
  }
})

userExercisesRouter.post('/', async (req, res) => {
  const exercises = req.body as unknown[]

  if (!Array.isArray(exercises)) {
    res.status(400).json({ error: 'Request body must be an array of exercises.' })
    return
  }

  if (exercises.length === 0) {
    res.json({ added: 0 })
    return
  }

  const client = await db.connect()
  let added = 0
  try {
    await client.query('BEGIN')
    for (const exercise of exercises) {
      const ex = exercise as Record<string, unknown>
      if (typeof ex.id !== 'string') continue
      await client.query(
        `INSERT INTO user_exercises (user_id, exercise_id, data)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, exercise_id) DO UPDATE SET data = EXCLUDED.data`,
        [req.userId, ex.id, JSON.stringify(exercise)]
      )
      added += 1
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to save user exercises:', error)
    res.status(500).json({ error: 'Failed to save exercises.' })
    return
  } finally {
    client.release()
  }

  res.status(201).json({ added })
})

userExercisesRouter.post('/share-all', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE user_exercises
       SET share_status = 'pending',
           share_requested_at = NOW(),
           reviewed_at = NULL,
           reviewed_by = NULL
       WHERE user_id = $1
         AND share_status IN ('private', 'rejected')`,
      [req.userId]
    )
    res.json({ requested: result.rowCount ?? 0 })
  } catch (error) {
    console.error('Failed to request sharing user exercises:', error)
    res.status(500).json({ error: 'Failed to request sharing.' })
  }
})

userExercisesRouter.delete('/', async (req, res) => {
  const topic = req.query.topic

  if (typeof topic !== 'string' || !topic) {
    res.status(400).json({ error: 'Query parameter "topic" is required.' })
    return
  }

  try {
    const result = await db.query(
      `DELETE FROM user_exercises
       WHERE user_id = $1 AND data->>'topic' = $2`,
      [req.userId, topic]
    )
    res.json({ deleted: result.rowCount ?? 0 })
  } catch (error) {
    console.error('Failed to delete user exercises by topic:', error)
    res.status(500).json({ error: 'Failed to delete exercises.' })
  }
})

userExercisesRouter.delete('/all', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM user_exercises WHERE user_id = $1', [req.userId])
    res.json({ deleted: result.rowCount ?? 0 })
  } catch (error) {
    console.error('Failed to clear user exercises:', error)
    res.status(500).json({ error: 'Failed to clear exercises.' })
  }
})

userExercisesRouter.delete('/:exerciseId', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM user_exercises WHERE user_id = $1 AND exercise_id = $2',
      [req.userId, req.params.exerciseId]
    )
    if (!result.rowCount || result.rowCount === 0) {
      res.status(404).json({ error: 'Exercise not found.' })
      return
    }
    res.json({ deleted: 1 })
  } catch (error) {
    console.error('Failed to delete user exercise:', error)
    res.status(500).json({ error: 'Failed to delete exercise.' })
  }
})
