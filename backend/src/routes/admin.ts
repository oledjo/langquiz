import { Router } from 'express'
import { requireAdmin, requireAuth } from '../auth/middleware'
import { db } from '../db/database'

type QuestionSource = 'global' | 'user'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function isValidExerciseShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const exercise = value as Record<string, unknown>

  if (
    typeof exercise.id !== 'string' ||
    typeof exercise.type !== 'string' ||
    typeof exercise.topic !== 'string' ||
    typeof exercise.subtopic !== 'string' ||
    typeof exercise.language !== 'string' ||
    typeof exercise.prompt !== 'string'
  ) {
    return false
  }

  if (
    typeof exercise.difficulty !== 'number' ||
    exercise.difficulty < 1 ||
    exercise.difficulty > 5
  ) {
    return false
  }

  if (exercise.type === 'selection') {
    return isStringArray(exercise.options) && typeof exercise.answer === 'number'
  }
  if (exercise.type === 'multiselect') {
    return isStringArray(exercise.options) && isNumberArray(exercise.answers)
  }
  if (exercise.type === 'free-type') {
    return isStringArray(exercise.answers)
  }

  return false
}

function parseSource(input: string): QuestionSource | null {
  if (input === 'global') return 'global'
  if (input === 'user') return 'user'
  return null
}

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)

adminRouter.get('/questions', async (_req, res) => {
  try {
    const [globalResult, userResult] = await Promise.all([
      db.query('SELECT id, exercise_id, data FROM exercises ORDER BY exercise_id ASC'),
      db.query(
        `SELECT ue.id, ue.exercise_id, ue.data, ue.user_id, u.email AS owner_email
         FROM user_exercises ue
         JOIN users u ON u.id = ue.user_id
         ORDER BY ue.created_at ASC`
      ),
    ])

    const payload = [
      ...globalResult.rows.map((row: { id: number; exercise_id: string; data: unknown }) => ({
        recordId: row.id,
        source: 'global' as const,
        ownerUserId: null,
        ownerEmail: null,
        exerciseId: row.exercise_id,
        exercise: row.data,
      })),
      ...userResult.rows.map(
        (row: {
          id: number
          exercise_id: string
          data: unknown
          user_id: number
          owner_email: string
        }) => ({
          recordId: row.id,
          source: 'user' as const,
          ownerUserId: row.user_id,
          ownerEmail: row.owner_email,
          exerciseId: row.exercise_id,
          exercise: row.data,
        })
      ),
    ]

    res.json(payload)
  } catch (error) {
    console.error('Failed to load admin questions:', error)
    res.status(500).json({ error: 'Failed to load questions.' })
  }
})

adminRouter.patch('/questions/:source/:recordId', async (req, res) => {
  const source = parseSource(req.params.source)
  const recordId = Number(req.params.recordId)
  const exercise = (req.body as { exercise?: unknown }).exercise

  if (!source) {
    res.status(400).json({ error: 'Invalid source. Use "global" or "user".' })
    return
  }
  if (!Number.isInteger(recordId) || recordId <= 0) {
    res.status(400).json({ error: 'recordId must be a positive integer.' })
    return
  }
  if (!isValidExerciseShape(exercise)) {
    res.status(400).json({ error: 'Invalid exercise payload.' })
    return
  }

  try {
    if (source === 'global') {
      const result = await db.query(
        `UPDATE exercises
         SET exercise_id = $1, data = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id`,
        [exercise.id, JSON.stringify(exercise), recordId]
      )
      if (!result.rowCount) {
        res.status(404).json({ error: 'Question not found.' })
        return
      }
      res.json({ ok: true })
      return
    }

    const result = await db.query(
      `UPDATE user_exercises
       SET exercise_id = $1, data = $2
       WHERE id = $3
       RETURNING id`,
      [exercise.id, JSON.stringify(exercise), recordId]
    )
    if (!result.rowCount) {
      res.status(404).json({ error: 'Question not found.' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to update admin question:', error)
    res.status(500).json({ error: 'Failed to update question.' })
  }
})

adminRouter.delete('/questions/:source/:recordId', async (req, res) => {
  const source = parseSource(req.params.source)
  const recordId = Number(req.params.recordId)

  if (!source) {
    res.status(400).json({ error: 'Invalid source. Use "global" or "user".' })
    return
  }
  if (!Number.isInteger(recordId) || recordId <= 0) {
    res.status(400).json({ error: 'recordId must be a positive integer.' })
    return
  }

  try {
    const table = source === 'global' ? 'exercises' : 'user_exercises'
    const result = await db.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [recordId])
    if (!result.rowCount) {
      res.status(404).json({ error: 'Question not found.' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to delete admin question:', error)
    res.status(500).json({ error: 'Failed to delete question.' })
  }
})
