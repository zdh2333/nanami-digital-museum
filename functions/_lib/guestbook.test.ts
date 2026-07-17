import { describe, expect, it } from 'vitest'
import {
  createGuestbookEntry,
  decodeGuestbookCursor,
  encodeGuestbookCursor,
  enforceRateLimit,
  getVisitor,
  listPublicGuestbookEntries,
  serializePublicEntry,
  toggleGuestbookReaction,
  verifyTurnstile,
  type GuestbookEntryRecord,
  type GuestbookStorageEnv,
} from './guestbook'

type Query = { sql: string; values: unknown[] }

function makeDb(options: {
  rows?: Record<string, unknown>[]
  reactionRows?: Record<string, unknown>[]
  firstRows?: Record<string, unknown>[],
  changes?: number[],
} = {}) {
  const queries: Query[] = []
  let firstIndex = 0
  let changeIndex = 0

  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...bound: unknown[]) => statement(sql, bound),
    all: async <T>() => {
      queries.push({ sql, values })
      const results = sql.includes('FROM guestbook_reactions')
        ? (options.reactionRows ?? [])
        : (options.rows ?? [])
      return { results: results as T[], success: true, meta: {} }
    },
    first: async <T>() => {
      queries.push({ sql, values })
      return (options.firstRows?.[firstIndex++] ?? null) as T | null
    },
    run: async () => {
      queries.push({ sql, values })
      return {
        success: true,
        meta: { changes: options.changes?.[changeIndex++] ?? 1 },
      }
    },
  })

  return {
    db: { prepare: (sql: string) => statement(sql) },
    queries,
  }
}

function envWith(db: ReturnType<typeof makeDb>['db']): GuestbookStorageEnv {
  return {
    DB: db as unknown as GuestbookStorageEnv['DB'],
    PHOTOS: {} as GuestbookStorageEnv['PHOTOS'],
    IMAGE_SANITIZER: {} as GuestbookStorageEnv['IMAGE_SANITIZER'],
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    GUESTBOOK_HMAC_KEY: 'guestbook-hmac-secret',
  }
}

const publicRecord: GuestbookEntryRecord = {
  id: 'entry-2',
  nickname: 'Momo',
  message: 'Hello Nanami',
  entry_emoji: '🐾',
  photo_key: null,
  photo_status: 'none',
  hidden: 0,
  created_at: 1_700_000_000_000,
}

describe('guestbook persistence helpers', () => {
  it('does not serialize pending photos and counts only permitted reactions', () => {
    const entry = serializePublicEntry(
      { ...publicRecord, id: 'e1', photo_status: 'pending', photo_key: 'pending/e1.webp' },
      [{ emoji: '🐾', total: 2 }, { emoji: '🔥', total: 99 }],
    )

    expect(entry.photoUrl).toBeNull()
    expect(entry.reactions).toEqual([{ emoji: '🐾', total: 2 }])
  })

  it.each([
    ['none', null],
    ['pending', 'pending/e1.webp'],
    ['rejected', 'pending/e1.webp'],
    ['approved hidden', 'approved/e1.webp', 1],
  ] as const)('does not expose %s photos', (photoStatus, photoKey, hidden: number = 0) => {
    expect(serializePublicEntry({
      ...publicRecord,
      photo_status: photoStatus === 'approved hidden' ? 'approved' : photoStatus,
      photo_key: photoKey,
      hidden,
    }, []).photoUrl).toBeNull()
  })

  it('exposes only approved non-hidden WebP photo routes', () => {
    expect(serializePublicEntry({
      ...publicRecord,
      id: 'approved-entry',
      photo_status: 'approved',
      photo_key: 'pending/private.webp',
    }, []).photoUrl).toBe('/api/guestbook/photos/approved-entry')
  })

  it('signs a random HttpOnly visitor cookie and derives a stable HMAC hash without retaining raw token data', async () => {
    const first = await getVisitor(new Request('https://nanamicat.com/api/guestbook'), 'guestbook-hmac-secret', () => 'a0000000-0000-4000-8000-000000000001')

    expect(first.setCookie).toMatch(/^nanami_guestbook_visitor=/)
    expect(first.setCookie).toContain('HttpOnly')
    expect(first.setCookie).toContain('Secure')
    expect(first.setCookie).toContain('SameSite=Lax')
    expect(first.visitorHash).not.toContain('a0000000-0000-4000-8000-000000000001')

    const cookie = first.setCookie!.split(';', 1)[0]
    const second = await getVisitor(new Request('https://nanamicat.com/api/guestbook', { headers: { cookie } }), 'guestbook-hmac-secret')
    expect(second).toEqual({ visitorHash: first.visitorHash })
  })

  it('replaces an invalid visitor signature instead of trusting an unsigned browser token', async () => {
    const visitor = await getVisitor(new Request('https://nanamicat.com', {
      headers: { cookie: 'nanami_guestbook_visitor=raw-token.not-a-signature' },
    }), 'guestbook-hmac-secret', () => 'b0000000-0000-4000-8000-000000000002')

    expect(visitor.setCookie).toContain('b0000000-0000-4000-8000-000000000002')
    expect(visitor.visitorHash).not.toContain('raw-token')
  })

  it.each([
    ['entry', 3],
    ['reaction', 24],
  ] as const)('blocks a %s when the ten-minute window has reached its limit', async (action, limit) => {
    const { db, queries } = makeDb({ changes: [0] })

    await expect(enforceRateLimit(envWith(db), {
      fingerprintHash: 'hmac-only-fingerprint',
      action,
      now: 1_700_000_000_000,
    })).rejects.toThrow('Too many guestbook actions')

    expect(queries).toHaveLength(1)
    expect(queries[0].sql).toContain('SELECT COUNT(*)')
    expect(queries[0].values).toEqual([
      'hmac-only-fingerprint', action, 1_700_000_000_000,
      'hmac-only-fingerprint', action, 1_699_999_400_000, limit,
    ])
    expect(queries[0].values).not.toContain('raw-browser-token')
  })

  it('records a rate event after allowing an action inside the active ten-minute window', async () => {
    const { db, queries } = makeDb({ changes: [1] })

    await expect(enforceRateLimit(envWith(db), {
      fingerprintHash: 'hmac-only-fingerprint',
      action: 'entry',
      now: 1_700_000_000_000,
    })).resolves.toBeUndefined()

    expect(queries).toHaveLength(1)
    expect(queries[0]).toMatchObject({
      values: [
        'hmac-only-fingerprint', 'entry', 1_700_000_000_000,
        'hmac-only-fingerprint', 'entry', 1_699_999_400_000, 3,
      ],
    })
  })

  it('sends only the Turnstile secret and response token to Siteverify', async () => {
    const requests: Request[] = []
    await expect(verifyTurnstile('turnstile-response', 'turnstile-secret', async (input, init) => {
      requests.push(new Request(input, init))
      return Response.json({ success: true })
    })).resolves.toBeUndefined()

    const request = requests[0]
    expect(request?.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(request?.method).toBe('POST')
    expect(await request?.text()).toBe('secret=turnstile-secret&response=turnstile-response')
  })

  it.each([
    ['', 'turnstile-secret', Response.json({ success: true })],
    ['turnstile-response', '', Response.json({ success: true })],
    ['turnstile-response', 'turnstile-secret', Response.json({ success: false })],
    ['turnstile-response', 'turnstile-secret', new Response('unavailable', { status: 503 })],
  ])('fails closed when Turnstile cannot verify a token', async (token, secret, response) => {
    await expect(verifyTurnstile(token, secret, async () => response)).rejects.toThrow('Turnstile verification failed')
  })

  it('uses a bound keyset cursor, a page size of 12, and public-only entries', async () => {
    const { db, queries } = makeDb({
      rows: [
        { ...publicRecord, id: 'entry-3', created_at: 1_700_000_000_003 },
        { ...publicRecord, id: 'entry-2', created_at: 1_700_000_000_002 },
      ],
      reactionRows: [{ entry_id: 'entry-3', emoji: '🖤', total: 4 }],
    })
    const cursor = encodeGuestbookCursor({ createdAt: 1_700_000_000_005, id: 'entry-5' })
    const page = await listPublicGuestbookEntries(envWith(db), cursor)

    expect(page).toEqual({
      entries: [
        expect.objectContaining({ id: 'entry-3', reactions: [{ emoji: '🖤', total: 4 }] }),
        expect.objectContaining({ id: 'entry-2', reactions: [] }),
      ],
      nextCursor: null,
    })
    expect(queries[0].sql).toContain('hidden = 0')
    expect(queries[0].sql).toContain('created_at < ?')
    expect(queries[0].values).toEqual([1_700_000_000_005, 1_700_000_000_005, 'entry-5', 13])
  })

  it('returns an opaque next cursor when a public page exceeds twelve entries', async () => {
    const rows = Array.from({ length: 13 }, (_, index) => ({
      ...publicRecord,
      id: `entry-${13 - index}`,
      created_at: 1_700_000_000_013 - index,
    }))
    const { db } = makeDb({ rows })

    const page = await listPublicGuestbookEntries(envWith(db))

    expect(page.entries).toHaveLength(12)
    expect(decodeGuestbookCursor(page.nextCursor!)).toEqual({
      createdAt: rows[11].created_at,
      id: rows[11].id,
    })
  })

  it('inserts a text entry with only its pending photo key and never a visitor token', async () => {
    const { db, queries } = makeDb()

    const entry = await createGuestbookEntry(envWith(db), {
      id: 'entry-new',
      nickname: 'Momo',
      message: 'Nice tail',
      emoji: '🐈‍⬛',
      photoKey: 'pending/entry-new.webp',
      photoStatus: 'pending',
      now: 1_700_000_000_000,
    })

    expect(entry).toMatchObject({ id: 'entry-new', photo_status: 'pending' })
    expect(queries[0].values).toEqual([
      'entry-new', 'Momo', 'Nice tail', '🐈‍⬛', 'pending/entry-new.webp', 'pending', 1_700_000_000_000,
    ])
    expect(queries[0].values.join(' ')).not.toContain('visitor')
  })

  it('toggles one reaction per HMAC visitor and emoji by relying on the D1 uniqueness key', async () => {
    const { db, queries } = makeDb({
      firstRows: [{ id: 'entry-1' }, { total: 1 }],
      changes: [1],
    })

    await expect(toggleGuestbookReaction(envWith(db), {
      entryId: 'entry-1',
      visitorHash: 'hmac-visitor-only',
      emoji: '🐾',
      now: 1_700_000_000_000,
    })).resolves.toEqual({ active: true, total: 1 })

    expect(queries.map(({ sql }) => sql)).toEqual([
      expect.stringContaining('WHERE id = ? AND hidden = 0'),
      expect.stringContaining('ON CONFLICT(entry_id, visitor_hash, emoji) DO NOTHING'),
      expect.stringContaining('COUNT(*) AS total'),
    ])
    expect(queries[1].values).toEqual(['entry-1', 'hmac-visitor-only', '🐾', 1_700_000_000_000])
  })

  it('removes the exact existing reaction when the unique reaction key already exists', async () => {
    const { db, queries } = makeDb({
      firstRows: [{ id: 'entry-1' }, { total: 0 }],
      changes: [0, 1],
    })

    await expect(toggleGuestbookReaction(envWith(db), {
      entryId: 'entry-1',
      visitorHash: 'hmac-visitor-only',
      emoji: '🖤',
      now: 1_700_000_000_000,
    })).resolves.toEqual({ active: false, total: 0 })

    expect(queries[2].sql).toContain('DELETE FROM guestbook_reactions')
    expect(queries[2].values).toEqual(['entry-1', 'hmac-visitor-only', '🖤'])
  })
})
