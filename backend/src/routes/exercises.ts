import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'

export const exercisesRouter = Router()

exercisesRouter.use(requireAuth)

exercisesRouter.get('/', async (req, res) => {
  try {
    const globalResult = await db.query(
      `SELECT
         e.exercise_id,
         e.data,
         COALESCE(v.vote_count, 0) AS vote_count,
         (uv.exercise_id IS NOT NULL) AS user_voted
       FROM exercises e
       LEFT JOIN (
         SELECT exercise_id, COUNT(*)::INT AS vote_count
         FROM exercise_votes
         GROUP BY exercise_id
       ) v ON v.exercise_id = e.exercise_id
       LEFT JOIN exercise_votes uv
         ON uv.exercise_id = e.exercise_id AND uv.user_id = $1
       ORDER BY e.exercise_id ASC`,
      [req.userId]
    )
    const userResult = await db.query(
      `SELECT
         ue.exercise_id,
         ue.data,
         ue.share_status,
         COALESCE(v.vote_count, 0) AS vote_count,
         (uv.exercise_id IS NOT NULL) AS user_voted
       FROM user_exercises
       LEFT JOIN (
         SELECT exercise_id, COUNT(*)::INT AS vote_count
         FROM exercise_votes
         GROUP BY exercise_id
       ) v ON v.exercise_id = user_exercises.exercise_id
       LEFT JOIN exercise_votes uv
         ON uv.exercise_id = user_exercises.exercise_id AND uv.user_id = $2
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.userId, req.userId]
    )

    const combined = [
      ...globalResult.rows.map(
        (row: {
          data: Record<string, unknown>
          vote_count: number
          user_voted: boolean
        }) => ({
        ...row.data,
        isUserAdded: false,
        voteCount: row.vote_count,
        userVoted: row.user_voted,
      })
      ),
      ...userResult.rows.map(
        (row: {
          data: Record<string, unknown>
          share_status: string
          vote_count: number
          user_voted: boolean
        }) => ({
        ...row.data,
        isUserAdded: true,
        shareStatus: row.share_status,
        voteCount: row.vote_count,
        userVoted: row.user_voted,
      })
      ),
    ]

    res.json(combined)
  } catch (error) {
    console.error('Failed to load exercises:', error)
    res.status(500).json({ error: 'Failed to load exercises.' })
  }
})

exercisesRouter.post('/:exerciseId/vote', async (req, res) => {
  const { exerciseId } = req.params
  if (!exerciseId) {
    res.status(400).json({ error: 'Exercise id is required.' })
    return
  }

  try {
    await db.query(
      `INSERT INTO exercise_votes (user_id, exercise_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, exercise_id) DO NOTHING`,
      [req.userId, exerciseId]
    )

    const countResult = await db.query(
      'SELECT COUNT(*)::INT AS vote_count FROM exercise_votes WHERE exercise_id = $1',
      [exerciseId]
    )
    res.json({ voteCount: countResult.rows[0]?.vote_count ?? 0, userVoted: true })
  } catch (error) {
    console.error('Failed to add vote:', error)
    res.status(500).json({ error: 'Failed to add vote.' })
  }
})

exercisesRouter.delete('/:exerciseId/vote', async (req, res) => {
  const { exerciseId } = req.params
  if (!exerciseId) {
    res.status(400).json({ error: 'Exercise id is required.' })
    return
  }

  try {
    await db.query('DELETE FROM exercise_votes WHERE user_id = $1 AND exercise_id = $2', [req.userId, exerciseId])
    const countResult = await db.query(
      'SELECT COUNT(*)::INT AS vote_count FROM exercise_votes WHERE exercise_id = $1',
      [exerciseId]
    )
    res.json({ voteCount: countResult.rows[0]?.vote_count ?? 0, userVoted: false })
  } catch (error) {
    console.error('Failed to remove vote:', error)
    res.status(500).json({ error: 'Failed to remove vote.' })
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
