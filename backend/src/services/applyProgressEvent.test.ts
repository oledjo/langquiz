import { describe, expect, test } from 'vitest'
import { applyProgressEvent, type ProgressDbClient, type ProgressEventInput } from './applyProgressEvent'

/** Records statements and simulates the (user_id, idempotency_key) unique constraint. */
class FakeClient implements ProgressDbClient {
  ran: { text: string; values: unknown[] }[] = []
  private seenKeys = new Map<string, { exercise_id: string; correct: boolean; answer_grade: string }>()
  scheduleRow: Record<string, unknown> | null = null

  async query(text: string, values: unknown[] = []): Promise<{ rows: any[]; rowCount: number }> {
    this.ran.push({ text: text.trim().split('\n')[0], values })

    if (text.includes('INSERT INTO progress') && text.includes('ON CONFLICT (user_id, idempotency_key)')) {
      const key = `${values[2]}:${values[3]}`
      if (this.seenKeys.has(key)) return { rows: [], rowCount: 0 }
      this.seenKeys.set(key, {
        exercise_id: values[0] as string,
        correct: values[1] as boolean,
        answer_grade: values[4] as string,
      })
      return { rows: [{ id: this.seenKeys.size }], rowCount: 1 }
    }
    if (text.includes('SELECT exercise_id, correct, answer_grade') && text.includes('FROM progress')) {
      const key = `${values[0]}:${values[1]}`
      const existing = this.seenKeys.get(key)
      return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 }
    }
    if (text.includes('INSERT INTO progress') && !text.includes('ON CONFLICT (user_id, idempotency_key)')) {
      return { rows: [], rowCount: 1 }
    }
    if (text.includes('FROM user_review_schedule')) {
      return { rows: this.scheduleRow ? [this.scheduleRow] : [], rowCount: this.scheduleRow ? 1 : 0 }
    }
    if (text.includes('INTO user_review_schedule')) {
      return { rows: [], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  }
}

const base: ProgressEventInput = {
  userId: 42,
  exerciseId: 'de-grammar-articles-001-3',
  correct: true,
  grade: 'good',
  mode: 'practice',
  idempotencyKey: 'key-abc',
}

describe('applyProgressEvent', () => {
  test('first call with an idempotency key inserts and returns "acked", and writes a schedule row', async () => {
    const client = new FakeClient()
    const status = await applyProgressEvent(client, base)
    expect(status).toBe('acked')
    expect(client.ran.some((s) => s.text.includes('INTO user_review_schedule'))).toBe(true)
  })

  test('replaying the same key with the same payload returns "duplicate" and does not touch the schedule', async () => {
    const client = new FakeClient()
    await applyProgressEvent(client, base)
    const before = client.ran.length
    const status = await applyProgressEvent(client, base)
    expect(status).toBe('duplicate')
    expect(client.ran.slice(before).some((s) => s.text.includes('INTO user_review_schedule'))).toBe(false)
  })

  test('reusing a key with a different payload returns "conflict"', async () => {
    const client = new FakeClient()
    await applyProgressEvent(client, base)
    const status = await applyProgressEvent(client, { ...base, correct: false, grade: 'again' })
    expect(status).toBe('conflict')
  })

  test('exam mode inserts progress but skips the schedule update', async () => {
    const client = new FakeClient()
    const status = await applyProgressEvent(client, { ...base, mode: 'exam', idempotencyKey: 'key-exam' })
    expect(status).toBe('acked')
    expect(client.ran.some((s) => s.text.includes('INTO user_review_schedule'))).toBe(false)
  })

  test('with a null idempotency key it always inserts (plain INSERT, no ON CONFLICT) and returns "acked"', async () => {
    const client = new FakeClient()
    const status = await applyProgressEvent(client, { ...base, idempotencyKey: null })
    expect(status).toBe('acked')
    expect(client.ran.some((s) => s.text.includes('ON CONFLICT (user_id, idempotency_key)'))).toBe(false)
  })
})
