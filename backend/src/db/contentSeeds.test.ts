import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from './database'
import { CONTENT_SEEDS, runContentSeeds, type ContentSeed } from './contentSeeds'

/** Answers the runner's SELECT with whatever checksum the test has stored for that seed. */
function stubDb(stored: Map<string, string>) {
  return vi.spyOn(db, 'query').mockImplementation((async (text: string, values: unknown[] = []) => {
    if (text.includes('SELECT checksum FROM content_seeds')) {
      const checksum = stored.get(values[0] as string)
      return { rows: checksum ? [{ checksum }] : [], rowCount: checksum ? 1 : 0 }
    }
    if (text.trim().startsWith('INSERT INTO content_seeds')) {
      stored.set(values[0] as string, values[1] as string)
      return { rows: [], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  }) as unknown as typeof db.query)
}

function seed(name: string, checksum: string, run = vi.fn(async () => 'done')): ContentSeed {
  return { name, checksum: () => checksum, run }
}

describe('runContentSeeds', () => {
  let stored: Map<string, string>

  beforeEach(() => {
    stored = new Map()
    delete process.env.SKIP_CONTENT_SEED
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SKIP_CONTENT_SEED
  })

  test('runs a seed that has never been applied and records its checksum', async () => {
    stubDb(stored)
    const run = vi.fn(async () => '3 things')

    await runContentSeeds([seed('demo', 'abc', run)])

    expect(run).toHaveBeenCalledOnce()
    expect(stored.get('demo')).toBe('abc')
  })

  test('skips a seed whose checksum is unchanged', async () => {
    stored.set('demo', 'abc')
    stubDb(stored)
    const run = vi.fn(async () => 'done')

    await runContentSeeds([seed('demo', 'abc', run)])

    expect(run).not.toHaveBeenCalled()
  })

  test('re-runs a seed whose checksum has moved', async () => {
    stored.set('demo', 'old')
    stubDb(stored)
    const run = vi.fn(async () => 'done')

    await runContentSeeds([seed('demo', 'new', run)])

    expect(run).toHaveBeenCalledOnce()
    expect(stored.get('demo')).toBe('new')
  })

  test('does not record a checksum when the seed throws, so the next boot retries', async () => {
    stubDb(stored)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const run = vi.fn(async () => {
      throw new Error('bad content')
    })

    await runContentSeeds([seed('demo', 'abc', run)])

    expect(stored.has('demo')).toBe(false)
  })

  test('a failing seed does not stop the ones after it', async () => {
    stubDb(stored)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const second = vi.fn(async () => 'done')

    await runContentSeeds([
      seed('first', 'a', vi.fn(async () => {
        throw new Error('bad content')
      })),
      seed('second', 'b', second),
    ])

    expect(second).toHaveBeenCalledOnce()
    expect(stored.get('second')).toBe('b')
  })

  test('SKIP_CONTENT_SEED=true runs nothing at all', async () => {
    process.env.SKIP_CONTENT_SEED = 'true'
    const query = stubDb(stored)
    const run = vi.fn(async () => 'done')

    await runContentSeeds([seed('demo', 'abc', run)])

    expect(run).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })
})

describe('CONTENT_SEEDS', () => {
  test('have unique names', () => {
    const names = CONTENT_SEEDS.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('produce a stable, non-empty checksum from the vendored content', () => {
    for (const contentSeed of CONTENT_SEEDS) {
      const first = contentSeed.checksum()
      expect(first, `${contentSeed.name} produced an empty checksum`).toBeTruthy()
      // Same inputs, same hash — otherwise every boot would re-seed everything.
      expect(contentSeed.checksum()).toBe(first)
    }
  })
})
