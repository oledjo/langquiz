import crypto from 'crypto'
import { Router } from 'express'
import { requireAuth } from '../auth/middleware'
import { db } from '../db/database'
import { rateLimit } from '../middleware/security'

export const ankiImportRouter = Router()
const applyLimiter = rateLimit({ keyPrefix: 'anki-import-apply', windowMs: 10 * 60 * 1000, max: 10 })

ankiImportRouter.use(requireAuth)

type Candidate = {
  status: 'ready' | 'needs_review'
  reason?: string
  exercise?: Record<string, unknown>
  source?: { ankiCardId?: string; ankiNoteId?: string; deck?: string; model?: string }
  schedule?: {
    repetitionCount?: number; intervalDays?: number; lapseCount?: number; easeFactor?: number
    state?: number; dueAt?: string; lastReviewedAt?: string | null; sourceScheduler?: string; schedulerVersion?: string
  }
}

type Manifest = { candidates: Candidate[]; sourceDecks: string[]; importerVersion: string; manifestHash?: string }

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function manifestHash(manifest: Omit<Manifest, 'manifestHash'>): string {
  return crypto.createHash('sha256').update(stableJson(manifest), 'utf8').digest('hex')
}

function parseManifest(body: unknown): { manifest: Omit<Manifest, 'manifestHash'>; hash: string; error?: string } {
  if (!body || typeof body !== 'object') return { manifest: { candidates: [], sourceDecks: [], importerVersion: '' }, hash: '', error: 'Request body must be an import manifest' }
  const record = body as Record<string, unknown>
  if ('reviewHistory' in record || 'review_history' in record || 'reviewEvents' in record) {
    return { manifest: { candidates: [], sourceDecks: [], importerVersion: '' }, hash: '', error: 'Review-history events are not supported by this importer' }
  }
  if (!Array.isArray(record.candidates) || !Array.isArray(record.sourceDecks) || typeof record.importerVersion !== 'string') {
    return { manifest: { candidates: [], sourceDecks: [], importerVersion: '' }, hash: '', error: 'Manifest candidates, sourceDecks and importerVersion are required' }
  }
  const manifest = { candidates: record.candidates as Candidate[], sourceDecks: record.sourceDecks.filter((value): value is string => typeof value === 'string'), importerVersion: record.importerVersion }
  const hash = manifestHash(manifest)
  if (record.manifestHash !== undefined && record.manifestHash !== hash) return { manifest, hash, error: 'Declared manifest hash does not match normalized candidates' }
  return { manifest, hash }
}

function summary(candidates: Candidate[]) {
  return candidates.reduce((result, candidate) => {
    if (candidate.status === 'ready' && candidate.exercise && candidate.source && candidate.schedule) result.ready += 1
    else if (candidate.status === 'needs_review') result.needs_review += 1
    else result.skipped += 1
    return result
  }, { ready: 0, needs_review: 0, skipped: 0 })
}

ankiImportRouter.post('/analyze', (req, res) => {
  const parsed = parseManifest(req.body)
  if (parsed.error) {
    res.status(400).json({ error: parsed.error })
    return
  }
  res.json({ manifest_hash: parsed.hash, ...summary(parsed.manifest.candidates), history_status: 'unavailable' })
})

ankiImportRouter.post('/apply', applyLimiter, async (req, res) => {
  const parsed = parseManifest(req.body)
  if (parsed.error) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const client = await db.connect()
  const totals = summary(parsed.manifest.candidates)
  try {
    await client.query('BEGIN')
    const run = await client.query<{ id: number }>(
      `INSERT INTO anki_import_runs (user_id, manifest_hash, mode, status, source_decks, summary, history_status, importer_version, finished_at)
       VALUES ($1, $2, 'apply', 'applied', $3, $4, 'unavailable', $5, NOW()) RETURNING id`,
      [req.userId, parsed.hash, JSON.stringify(parsed.manifest.sourceDecks), JSON.stringify(totals), parsed.manifest.importerVersion]
    )
    const runId = run.rows[0]?.id
    if (!runId) throw new Error('Failed to create import run')

    for (const candidate of parsed.manifest.candidates) {
      if (candidate.status !== 'ready' || !candidate.exercise || !candidate.source || !candidate.schedule ||
          typeof candidate.exercise.id !== 'string' || !candidate.source.ankiCardId || !candidate.source.ankiNoteId || !candidate.source.deck || !candidate.source.model || !candidate.schedule.dueAt) {
        const source = candidate.source
        if (source?.ankiCardId && source.ankiNoteId && source.deck && source.model) {
          await client.query(
            `INSERT INTO anki_import_card_mappings (user_id, anki_card_id, anki_note_id, source_deck, source_model, exercise_id, content_hash, schedule_hash, import_run_id, status, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'needs_review', $10)
             ON CONFLICT (user_id, anki_card_id) DO UPDATE SET import_run_id = EXCLUDED.import_run_id, status = EXCLUDED.status, reason = EXCLUDED.reason, updated_at = NOW()`,
            [req.userId, source.ankiCardId, source.ankiNoteId, source.deck, source.model, `anki-${source.ankiCardId}`, '', '', runId, candidate.reason ?? 'Incomplete import candidate']
          )
        }
        continue
      }
      const exercise = { ...candidate.exercise, isUserAdded: true, shareStatus: 'private' }
      const contentHash = crypto.createHash('sha256').update(stableJson(exercise)).digest('hex')
      const scheduleHash = crypto.createHash('sha256').update(stableJson(candidate.schedule)).digest('hex')
      const exerciseId = candidate.exercise.id
      await client.query(
        `INSERT INTO user_exercises (user_id, exercise_id, data, share_status)
         VALUES ($1, $2, $3, 'private')
         ON CONFLICT (user_id, exercise_id) DO UPDATE SET data = EXCLUDED.data, share_status = 'private'`,
        [req.userId, exerciseId, JSON.stringify(exercise)]
      )
      await client.query(
        `INSERT INTO user_review_schedule (user_id, exercise_id, repetition_count, interval_days, ease_factor, state, due_at, last_reviewed_at, lapse_count, scheduler_version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (user_id, exercise_id) DO UPDATE SET repetition_count = EXCLUDED.repetition_count, interval_days = EXCLUDED.interval_days, ease_factor = EXCLUDED.ease_factor, state = EXCLUDED.state, due_at = EXCLUDED.due_at, last_reviewed_at = EXCLUDED.last_reviewed_at, lapse_count = EXCLUDED.lapse_count, scheduler_version = EXCLUDED.scheduler_version, updated_at = NOW()`,
        [req.userId, exerciseId, candidate.schedule.repetitionCount ?? 0, candidate.schedule.intervalDays ?? 0, candidate.schedule.easeFactor ?? 2.5, candidate.schedule.state ?? 0, candidate.schedule.dueAt, candidate.schedule.lastReviewedAt ?? null, candidate.schedule.lapseCount ?? 0, candidate.schedule.schedulerVersion ?? 'anki-sm2-import-v1']
      )
      await client.query(
        `INSERT INTO anki_import_card_mappings (user_id, anki_card_id, anki_note_id, source_deck, source_model, exercise_id, content_hash, schedule_hash, import_run_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'imported')
         ON CONFLICT (user_id, anki_card_id) DO UPDATE SET anki_note_id = EXCLUDED.anki_note_id, source_deck = EXCLUDED.source_deck, source_model = EXCLUDED.source_model, exercise_id = EXCLUDED.exercise_id, content_hash = EXCLUDED.content_hash, schedule_hash = EXCLUDED.schedule_hash, import_run_id = EXCLUDED.import_run_id, status = EXCLUDED.status, reason = NULL, updated_at = NOW()`,
        [req.userId, candidate.source.ankiCardId, candidate.source.ankiNoteId, candidate.source.deck, candidate.source.model, exerciseId, contentHash, scheduleHash, runId]
      )
    }
    await client.query('COMMIT')
    res.status(201).json({ id: runId, manifest_hash: parsed.hash, ...totals, history_status: 'unavailable' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to apply Anki import:', error)
    res.status(500).json({ error: 'Failed to apply Anki import' })
  } finally {
    client.release()
  }
})

ankiImportRouter.get('/runs/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid import run id' })
    return
  }
  try {
    const result = await db.query(
      `SELECT id, manifest_hash, mode, status, source_decks, summary, history_status, importer_version, started_at, finished_at
       FROM anki_import_runs WHERE id = $1 AND user_id = $2`, [id, req.userId]
    )
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Import run not found' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Failed to fetch Anki import run:', error)
    res.status(500).json({ error: 'Failed to load import run' })
  }
})
