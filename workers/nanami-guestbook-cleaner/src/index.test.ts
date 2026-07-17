import { describe, expect, it } from 'vitest'
import worker, {
  cleanupRateEvents,
  RATE_LIMIT_WINDOW_MS,
  type GuestbookCleanerEnv,
} from './index'

function makeDb() {
  const queries: Array<{ sql: string; values: unknown[] }> = []

  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...bound: unknown[]) => statement(sql, bound),
    async run() {
      queries.push({ sql, values })
      return { success: true, meta: { changes: 4 } }
    },
  })

  return { db: { prepare: (sql: string) => statement(sql) }, queries }
}

function envWith(db: unknown): GuestbookCleanerEnv {
  return { DB: db as GuestbookCleanerEnv['DB'] }
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
})
