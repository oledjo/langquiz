import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'

export const exercisesRouter = Router()

exercisesRouter.use(requireAuth)

exercisesRouter.get('/', async (req, res) => {
  try {
    const globalResult = await db.query(
      'SELECT data FROM exercises ORDER BY exercise_id ASC'
    )
    const userResult = await db.query(
      `SELECT data, share_status
       FROM user_exercises
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.userId]
    )

    const combined = [
      ...globalResult.rows.map((row: { data: Record<string, unknown> }) => ({
        ...row.data,
        isUserAdded: false,
      })),
      ...userResult.rows.map((row: { data: Record<string, unknown>; share_status: string }) => ({
        ...row.data,
        isUserAdded: true,
        shareStatus: row.share_status,
      })),
    ]

    res.json(combined)
  } catch (error) {
    console.error('Failed to load exercises:', error)
    res.status(500).json({ error: 'Failed to load exercises.' })
  }
})

exercisesRouter.post('/bootstrap', async (req, res) => {
  const exercises = req.body as unknown[]

  if (!Array.isArray(exercises)) {
    res.status(400).json({ error: 'Request body must be an array of exercises.' })
    return
  }

  if (exercises.length === 0) {
    res.json({ upserted: 0 })
    return
  }

  const client = await db.connect()
  let upserted = 0

  try {
    await client.query('BEGIN')
    for (const raw of exercises) {
      const ex = raw as Record<string, unknown>
      if (typeof ex.id !== 'string' || ex.id.trim() === '') continue

      await client.query(
        `INSERT INTO exercises (exercise_id, data)
         VALUES ($1, $2)
         ON CONFLICT (exercise_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [ex.id, JSON.stringify(raw)]
      )
      upserted += 1
    }
    await client.query('COMMIT')
    res.status(201).json({ upserted })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to bootstrap exercises:', error)
    res.status(500).json({ error: 'Failed to bootstrap exercises.' })
  } finally {
    client.release()
  }
})
