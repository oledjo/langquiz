import { Router } from 'express'
import { requireAdmin, requireAuth } from '../auth/middleware'
import { db } from '../db/database'

type QuestionSource = 'global' | 'user'
type ShareStatus = 'private' | 'pending' | 'approved' | 'rejected'
type AuditAction = 'approve' | 'approve_bulk' | 'reject' | 'update' | 'delete'

interface Queryable {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: unknown[]; rowCount: number | null }>
}

interface AdminSchemaCapabilities {
  hasRejectionReason: boolean
  hasAuditLog: boolean
}

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

  if (typeof exercise.difficulty !== 'number' || exercise.difficulty < 1 || exercise.difficulty > 5) {
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

async function getAdminSchemaCapabilities(): Promise<AdminSchemaCapabilities> {
  const [columnResult, tableResult] = await Promise.all([
    db.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'user_exercises'
         AND column_name = 'rejection_reason'
       LIMIT 1`
    ),
    db.query(`SELECT to_regclass('public.admin_question_audit_log') AS table_name`),
  ])

  const tableRow = tableResult.rows[0] as { table_name: string | null } | undefined
  return {
    hasRejectionReason: Boolean(columnResult.rowCount),
    hasAuditLog: Boolean(tableRow?.table_name),
  }
}

async function writeAuditLog(
  queryable: Queryable,
  capabilities: AdminSchemaCapabilities,
  input: {
    source: QuestionSource
    recordId: number
    exerciseId: string
    action: AuditAction
    actorUserId?: number
    note?: string | null
  }
): Promise<void> {
  if (!capabilities.hasAuditLog) return
  await queryable.query(
    `INSERT INTO admin_question_audit_log
      (question_source, target_record_id, exercise_id, action, actor_user_id, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.source, input.recordId, input.exerciseId, input.action, input.actorUserId ?? null, input.note ?? null]
  )
}

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)

adminRouter.get('/questions', async (_req, res) => {
  try {
    const capabilities = await getAdminSchemaCapabilities()
    const [globalResult, userResult] = await Promise.all([
      db.query('SELECT id, exercise_id, data FROM exercises ORDER BY exercise_id ASC'),
      db.query(
        `SELECT ue.id, ue.exercise_id, ue.data, ue.user_id, u.email AS owner_email, ue.share_status,
                ue.share_requested_at, ue.reviewed_at,
                ${capabilities.hasRejectionReason ? 'ue.rejection_reason' : 'NULL::text AS rejection_reason'},
                reviewer.email AS reviewer_email
         FROM user_exercises ue
         JOIN users u ON u.id = ue.user_id
         LEFT JOIN users reviewer ON reviewer.id = ue.reviewed_by
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
          share_status: ShareStatus
          share_requested_at: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          reviewer_email: string | null
        }) => ({
          recordId: row.id,
          source: 'user' as const,
          ownerUserId: row.user_id,
          ownerEmail: row.owner_email,
          exerciseId: row.exercise_id,
          exercise: row.data,
          shareStatus: row.share_status,
          shareRequestedAt: row.share_requested_at,
          reviewedAt: row.reviewed_at,
          rejectionReason: row.rejection_reason,
          reviewerEmail: row.reviewer_email,
        })
      ),
    ]

    res.json(payload)
  } catch (error) {
    console.error('Failed to load admin questions:', error)
    res.status(500).json({ error: 'Failed to load questions.' })
  }
})

adminRouter.get('/share-queue', async (_req, res) => {
  try {
    const capabilities = await getAdminSchemaCapabilities()
    const result = await db.query(
      `SELECT ue.id, ue.exercise_id, ue.data, ue.user_id, u.email AS owner_email, ue.share_status,
              ue.share_requested_at, ue.reviewed_at,
              ${capabilities.hasRejectionReason ? 'ue.rejection_reason' : 'NULL::text AS rejection_reason'},
              reviewer.email AS reviewer_email
       FROM user_exercises ue
       JOIN users u ON u.id = ue.user_id
       LEFT JOIN users reviewer ON reviewer.id = ue.reviewed_by
       WHERE ue.share_status = 'pending'
       ORDER BY ue.share_requested_at ASC NULLS LAST, ue.created_at ASC`
    )

    const payload = result.rows.map(
      (row: {
        id: number
        exercise_id: string
        data: unknown
        user_id: number
        owner_email: string
        share_status: ShareStatus
        share_requested_at: string | null
        reviewed_at: string | null
        rejection_reason: string | null
        reviewer_email: string | null
      }) => ({
        recordId: row.id,
        source: 'user' as const,
        ownerUserId: row.user_id,
        ownerEmail: row.owner_email,
        exerciseId: row.exercise_id,
        exercise: row.data,
        shareStatus: row.share_status,
        shareRequestedAt: row.share_requested_at,
        reviewedAt: row.reviewed_at,
        rejectionReason: row.rejection_reason,
        reviewerEmail: row.reviewer_email,
      })
    )
    res.json(payload)
  } catch (error) {
    console.error('Failed to load share queue:', error)
    res.status(500).json({ error: 'Failed to load share queue.' })
  }
})

adminRouter.post('/share-queue/:recordId/approve', async (req, res) => {
  const recordId = Number(req.params.recordId)
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : ''

  if (!Number.isInteger(recordId) || recordId <= 0) {
    res.status(400).json({ error: 'recordId must be a positive integer.' })
    return
  }

  const client = await db.connect()
  try {
    const capabilities = await getAdminSchemaCapabilities()
    await client.query('BEGIN')
    const rowResult = await client.query(
      `SELECT id, exercise_id, data
       FROM user_exercises
       WHERE id = $1 AND share_status = 'pending'
       FOR UPDATE`,
      [recordId]
    )
    if (!rowResult.rowCount) {
      await client.query('ROLLBACK')
      res.status(404).json({ error: 'Pending question not found.' })
      return
    }

    const row = rowResult.rows[0] as { id: number; exercise_id: string; data: unknown }
    await client.query(
      `INSERT INTO exercises (exercise_id, data)
       VALUES ($1, $2)
       ON CONFLICT (exercise_id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [row.exercise_id, JSON.stringify(row.data)]
    )

    await client.query(
      `UPDATE user_exercises
       SET share_status = 'approved',
           reviewed_at = NOW(),
           reviewed_by = $2
           ${capabilities.hasRejectionReason ? ', rejection_reason = NULL' : ''}
       WHERE id = $1`,
      [recordId, req.userId]
    )

    await writeAuditLog(client, capabilities, {
      source: 'user',
      recordId,
      exerciseId: row.exercise_id,
      action: 'approve',
      actorUserId: req.userId,
      note: note || null,
    })

    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to approve shared question:', error)
    res.status(500).json({ error: 'Failed to approve question.' })
  } finally {
    client.release()
  }
})

adminRouter.post('/share-queue/approve-bulk', async (req, res) => {
  const rawRecordIds = (req.body as { recordIds?: unknown }).recordIds
  const requestedIds = Array.isArray(rawRecordIds)
    ? rawRecordIds.filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0)
    : null
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : ''

  const client = await db.connect()
  try {
    const capabilities = await getAdminSchemaCapabilities()
    await client.query('BEGIN')
    const pendingResult = await client.query(
      `SELECT id, exercise_id, data
       FROM user_exercises
       WHERE share_status = 'pending'
         AND ($1::bigint[] IS NULL OR id = ANY($1::bigint[]))
       ORDER BY share_requested_at ASC NULLS LAST, created_at ASC
       FOR UPDATE`,
      [requestedIds && requestedIds.length > 0 ? requestedIds : null]
    )

    const pendingRows = pendingResult.rows as Array<{ id: number; exercise_id: string; data: unknown }>
    if (pendingRows.length === 0) {
      await client.query('ROLLBACK')
      res.json({ approved: 0 })
      return
    }

    for (const row of pendingRows) {
      await client.query(
        `INSERT INTO exercises (exercise_id, data)
         VALUES ($1, $2)
         ON CONFLICT (exercise_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [row.exercise_id, JSON.stringify(row.data)]
      )
    }

    await client.query(
      `UPDATE user_exercises
       SET share_status = 'approved',
           reviewed_at = NOW(),
           reviewed_by = $2
           ${capabilities.hasRejectionReason ? ', rejection_reason = NULL' : ''}
       WHERE id = ANY($1::bigint[])`,
      [pendingRows.map((row) => row.id), req.userId]
    )

    for (const row of pendingRows) {
      await writeAuditLog(client, capabilities, {
        source: 'user',
        recordId: row.id,
        exerciseId: row.exercise_id,
        action: 'approve_bulk',
        actorUserId: req.userId,
        note: note || null,
      })
    }

    await client.query('COMMIT')
    res.json({ approved: pendingRows.length })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to bulk approve shared questions:', error)
    res.status(500).json({ error: 'Failed to bulk approve questions.' })
  } finally {
    client.release()
  }
})

adminRouter.post('/share-queue/:recordId/reject', async (req, res) => {
  const recordId = Number(req.params.recordId)
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''

  if (!Number.isInteger(recordId) || recordId <= 0) {
    res.status(400).json({ error: 'recordId must be a positive integer.' })
    return
  }
  if (!reason) {
    res.status(400).json({ error: 'A rejection reason is required.' })
    return
  }

  try {
    const capabilities = await getAdminSchemaCapabilities()
    const result = await db.query(
      `UPDATE user_exercises
       SET share_status = 'rejected',
           reviewed_at = NOW(),
           reviewed_by = $2
           ${capabilities.hasRejectionReason ? ', rejection_reason = $3' : ''}
       WHERE id = $1
         AND share_status = 'pending'
       RETURNING id, exercise_id`,
      capabilities.hasRejectionReason ? [recordId, req.userId, reason] : [recordId, req.userId]
    )
    if (!result.rowCount) {
      res.status(404).json({ error: 'Pending question not found.' })
      return
    }

    const row = result.rows[0] as { id: number; exercise_id: string }
    await writeAuditLog(db, capabilities, {
      source: 'user',
      recordId: row.id,
      exerciseId: row.exercise_id,
      action: 'reject',
      actorUserId: req.userId,
      note: reason,
    })
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to reject shared question:', error)
    res.status(500).json({ error: 'Failed to reject question.' })
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
  const normalizedExercise = exercise as Record<string, unknown> & { id: string }

  try {
    if (source === 'global') {
      const result = await db.query(
        `UPDATE exercises
         SET exercise_id = $1, data = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id`,
        [normalizedExercise.id, JSON.stringify(exercise), recordId]
      )
      if (!result.rowCount) {
        res.status(404).json({ error: 'Question not found.' })
        return
      }
      await writeAuditLog(db, {
        hasRejectionReason: true,
        hasAuditLog: true,
      }, {
        source,
        recordId,
        exerciseId: normalizedExercise.id,
        action: 'update',
        actorUserId: req.userId,
      })
      res.json({ ok: true })
      return
    }

    const result = await db.query(
      `UPDATE user_exercises
       SET exercise_id = $1, data = $2
       WHERE id = $3
       RETURNING id`,
      [normalizedExercise.id, JSON.stringify(exercise), recordId]
    )
    if (!result.rowCount) {
      res.status(404).json({ error: 'Question not found.' })
      return
    }
    await writeAuditLog(db, {
      hasRejectionReason: true,
      hasAuditLog: true,
    }, {
      source,
      recordId,
      exerciseId: normalizedExercise.id,
      action: 'update',
      actorUserId: req.userId,
    })
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
    const result = await db.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id, exercise_id`, [recordId])
    if (!result.rowCount) {
      res.status(404).json({ error: 'Question not found.' })
      return
    }
    const row = result.rows[0] as { id: number; exercise_id: string }
    await writeAuditLog(db, {
      hasRejectionReason: true,
      hasAuditLog: true,
    }, {
      source,
      recordId: row.id,
      exerciseId: row.exercise_id,
      action: 'delete',
      actorUserId: req.userId,
    })
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to delete admin question:', error)
    res.status(500).json({ error: 'Failed to delete question.' })
  }
})

adminRouter.delete('/questions/:source/by-exercise/:exerciseId', async (req, res) => {
  const source = parseSource(req.params.source)
  const exerciseId = req.params.exerciseId?.trim()

  if (!source) {
    res.status(400).json({ error: 'Invalid source. Use "global" or "user".' })
    return
  }
  if (!exerciseId) {
    res.status(400).json({ error: 'exerciseId is required.' })
    return
  }

  try {
    const result =
      source === 'global'
        ? await db.query('DELETE FROM exercises WHERE exercise_id = $1 RETURNING id, exercise_id', [exerciseId])
        : await db.query(
            'DELETE FROM user_exercises WHERE exercise_id = $1 RETURNING id, exercise_id',
            [exerciseId]
          )

    if (!result.rowCount) {
      res.status(404).json({ error: 'Question not found.' })
      return
    }

    const row = result.rows[0] as { id: number; exercise_id: string }
    await writeAuditLog(
      db,
      {
        hasRejectionReason: true,
        hasAuditLog: true,
      },
      {
        source,
        recordId: row.id,
        exerciseId: row.exercise_id,
        action: 'delete',
        actorUserId: req.userId,
      }
    )
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to delete admin question by exercise id:', error)
    res.status(500).json({ error: 'Failed to delete question.' })
  }
})

adminRouter.get('/audit-log', async (req, res) => {
  const rawLimit = Number(req.query.limit)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50

  try {
    const capabilities = await getAdminSchemaCapabilities()
    if (!capabilities.hasAuditLog) {
      res.json([])
      return
    }
    const result = await db.query(
      `SELECT log.id, log.question_source, log.target_record_id, log.exercise_id, log.action, log.note, log.created_at,
              actor.email AS actor_email
       FROM admin_question_audit_log log
       LEFT JOIN users actor ON actor.id = log.actor_user_id
       ORDER BY log.created_at DESC
       LIMIT $1`,
      [limit]
    )

    res.json(
      result.rows.map(
        (row: {
          id: number
          question_source: QuestionSource
          target_record_id: number
          exercise_id: string
          action: AuditAction
          note: string | null
          created_at: string
          actor_email: string | null
        }) => ({
          id: row.id,
          source: row.question_source,
          recordId: row.target_record_id,
          exerciseId: row.exercise_id,
          action: row.action,
          note: row.note,
          createdAt: row.created_at,
          actorEmail: row.actor_email,
        })
      )
    )
  } catch (error) {
    console.error('Failed to load admin audit log:', error)
    res.status(500).json({ error: 'Failed to load admin audit log.' })
  }
})
