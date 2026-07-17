import { describe, expect, it, vi } from 'vitest'
import worker, {
  cleanupGuestbookPhotoOrphans,
  cleanupRateEvents,
  ORPHAN_PHOTO_GRACE_MS,
  RATE_LIMIT_WINDOW_MS,
  type GuestbookCleanerEnv,
} from './index'

function makeDb() {
  const queries: Array<{ sql: string; values: unknown[] }> = []

  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...bound: unknown[]) => statement(sql, bound),
    async all() {
      queries.push({ sql, values })
      return { results: [], success: true, meta: {} }
    },
    async first() {
      queries.push({ sql, values })
      return null
    },
    async run() {
      queries.push({ sql, values })
      return { success: true, meta: { changes: 4 } }
    },
  })

  return { db: { prepare: (sql: string) => statement(sql) }, queries }
}

function envWith(db: unknown, photos: Partial<R2Bucket> = {
  list: async () => ({ objects: [], truncated: false, delimitedPrefixes: [] }),
  delete: async () => undefined,
}): GuestbookCleanerEnv {
  return {
    DB: db as GuestbookCleanerEnv['DB'],
    PHOTOS: photos as R2Bucket,
  }
}

describe('Nanami guestbook rate-event cleaner', () => {
  it('deletes only events older than the shared ten-minute rate window', async () => {
    const { db, queries } = makeDb()
    const scheduledTime = 1_700_000_000_000

    await expect(cleanupRateEvents(envWith(db), scheduledTime)).resolves.toBeUndefined()

    expect(RATE_LIMIT_WINDOW_MS).toBe(10 * 60 * 1000)
    expect(queries).toEqual([{
      sql: 'DELETE FROM guestbook_rate_events WHERE created_at < ?',
      values: [scheduledTime - RATE_LIMIT_WINDOW_MS],
    }])
  })

  it('runs cleanup from the scheduled event even when no visitor writes occur', async () => {
    const { db, queries } = makeDb()
    const pending: Promise<unknown>[] = []

    await worker.scheduled!(
      { scheduledTime: 1_700_000_900_000 } as ScheduledController,
      envWith(db),
      { waitUntil: (promise: Promise<unknown>) => { pending.push(promise) } } as unknown as ExecutionContext,
    )
    await Promise.all(pending)

    expect(queries[0]?.values).toEqual([1_700_000_900_000 - RATE_LIMIT_WINDOW_MS])
  })

  it('deletes only stale, unreferenced pending R2 photos and clears their cleanup intents', async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = []
    const db = {
      prepare(sql: string) {
        return {
          bind: (...values: unknown[]) => ({
            all: async () => {
              queries.push({ sql, values })
              return { results: [], success: true, meta: {} }
            },
            first: async () => {
              queries.push({ sql, values })
              return values[0] === 'pending/referenced.webp' ? { id: 'entry-1' } : null
            },
            run: async () => {
              queries.push({ sql, values })
              return { success: true, meta: { changes: 1 } }
            },
          }),
        }
      },
    }
    const now = 1_700_000_000_000
    const remove = vi.fn(async () => undefined)
    const list = vi.fn(async () => ({
      objects: [
        { key: 'pending/orphan.webp', uploaded: new Date(now - ORPHAN_PHOTO_GRACE_MS - 1) },
        { key: 'pending/referenced.webp', uploaded: new Date(now - ORPHAN_PHOTO_GRACE_MS - 1) },
        { key: 'pending/fresh.webp', uploaded: new Date(now - ORPHAN_PHOTO_GRACE_MS + 1) },
      ],
      truncated: false,
      delimitedPrefixes: [],
    }))

    await cleanupGuestbookPhotoOrphans(envWith(db, {
      list: list as unknown as R2Bucket['list'],
      delete: remove,
    }), now)

    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('pending/orphan.webp')
    expect(queries).toContainEqual(expect.objectContaining({
      sql: expect.stringContaining('DELETE FROM guestbook_photo_cleanup'),
      values: ['pending/orphan.webp'],
    }))
  })

  it('retries stale durable intents and clears a referenced intent without deleting its photo', async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = []
    const db = {
      prepare(sql: string) {
        return {
          bind: (...values: unknown[]) => ({
            all: async () => {
              queries.push({ sql, values })
              return { results: [{ photo_key: 'pending/referenced.webp' }], success: true, meta: {} }
            },
            first: async () => {
              queries.push({ sql, values })
              return { id: 'entry-1' }
            },
            run: async () => {
              queries.push({ sql, values })
              return { success: true, meta: { changes: 1 } }
            },
          }),
        }
      },
    }
    const remove = vi.fn(async () => undefined)
    const list = vi.fn(async () => ({ objects: [], truncated: false, delimitedPrefixes: [] }))

    await cleanupGuestbookPhotoOrphans(envWith(db, {
      list: list as unknown as R2Bucket['list'],
      delete: remove,
    }), 1_700_000_000_000)

    expect(remove).not.toHaveBeenCalled()
    expect(queries).toContainEqual(expect.objectContaining({
      sql: 'DELETE FROM guestbook_photo_cleanup WHERE photo_key = ?',
      values: ['pending/referenced.webp'],
    }))
  })
})
