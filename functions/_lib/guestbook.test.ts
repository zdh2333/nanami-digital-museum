import { describe, expect, it } from 'vitest'
import {
  createGuestbookEntry,
  createGuestbookPhotoEntry,
  decodeGuestbookCursor,
  encodeGuestbookCursor,
  enforceRateLimit,
  getRateIdentity,
  getVisitor,
  listPublicGuestbookEntries,
  setGuestbookReaction,
  serializePublicEntry,
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

function makeReactionDb() {
  const queries: Query[] = []
  const reactions = new Set<string>()

  const statement = (sql: string, values: unknown[] = []) => ({
    sql,
    values,
    bind: (...bound: unknown[]) => statement(sql, bound),
  })

  return {
    db: {
      prepare: (sql: string) => statement(sql),
      batch: async (statements: unknown[]) => statements.map((rawStatement) => {
        const query = rawStatement as Query
        queries.push(query)

        if (query.sql.includes('SELECT id FROM guestbook_entries')) {
          return { results: [{ id: 'entry-1' }], success: true, meta: {} }
        }

        const key = `${query.values[0]}:${query.values[1]}:${query.values[2]}`
        if (query.sql.includes('INSERT INTO guestbook_reactions')) {
          reactions.add(key)
          return { results: [], success: true, meta: { changes: 1 } }
        }

        if (query.sql.includes('DELETE FROM guestbook_reactions')) {
          reactions.delete(key)
          return { results: [], success: true, meta: { changes: 1 } }
        }

        if (query.sql.includes('COUNT(*) AS total')) {
          const total = [...reactions].filter((reaction) => reaction.endsWith(`:${query.values[1]}`)).length
          return { results: [{ total }], success: true, meta: {} }
        }

        throw new Error(`Unexpected SQL in reaction mock: ${query.sql}`)
      }),
    },
    queries,
  }
}

function envWith(db: unknown): GuestbookStorageEnv {
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

  it('derives a stable server-side rate identity from CF-Connecting-IP without persisting the raw address', async () => {
    const request = new Request('https://nanamicat.com/api/guestbook', {
      headers: { 'cf-connecting-ip': '203.0.113.44' },
    })

    const first = await getRateIdentity(request, 'guestbook-hmac-secret')
    const second = await getRateIdentity(request, 'guestbook-hmac-secret')

    expect(first).toBe(second)
    expect(first).not.toContain('203.0.113.44')
    await expect(getRateIdentity(new Request('https://nanamicat.com/api/guestbook'), 'guestbook-hmac-secret'))
      .rejects.toThrow('Guestbook write protection is unavailable')
  })

  it.each([
    ['entry', 3],
    ['reaction', 24],
  ] as const)('blocks a %s when the ten-minute window has reached its limit', async (action, limit) => {
    const { db, queries } = makeDb({ changes: [1, 0] })

    await expect(enforceRateLimit(envWith(db), {
      fingerprintHash: 'hmac-only-fingerprint',
      action,
      now: 1_700_000_000_000,
    })).rejects.toThrow('Too many guestbook actions')

    expect(queries).toHaveLength(2)
    expect(queries[0]).toMatchObject({
      sql: expect.stringContaining('DELETE FROM guestbook_rate_events'),
      values: [1_699_999_400_000],
    })
    expect(queries[1].sql).toContain('SELECT COUNT(*)')
    expect(queries[1].values).toEqual([
      'hmac-only-fingerprint', action, 1_700_000_000_000,
      'hmac-only-fingerprint', action, 1_699_999_400_000, limit,
    ])
    expect(queries.flatMap(({ values }) => values)).not.toContain('raw-browser-token')
  })

  it('purges expired rate events before recording an allowed action inside the active ten-minute window', async () => {
    const { db, queries } = makeDb({ changes: [1, 1] })

    await expect(enforceRateLimit(envWith(db), {
      fingerprintHash: 'hmac-only-fingerprint',
      action: 'entry',
      now: 1_700_000_000_000,
    })).resolves.toBeUndefined()

    expect(queries).toHaveLength(2)
    expect(queries[0]).toMatchObject({
      sql: expect.stringContaining('DELETE FROM guestbook_rate_events'),
      values: [1_699_999_400_000],
    })
    expect(queries[1]).toMatchObject({
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
      return Response.json({ success: true, hostname: 'nanamicat.com' })
    })).resolves.toBeUndefined()

    const request = requests[0]
    expect(request?.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(request?.method).toBe('POST')
    expect(await request?.text()).toBe('secret=turnstile-secret&response=turnstile-response')
  })

  it.each([
    ['', 'turnstile-secret', Response.json({ success: true, hostname: 'nanamicat.com' })],
    ['turnstile-response', '', Response.json({ success: true, hostname: 'nanamicat.com' })],
    ['turnstile-response', 'turnstile-secret', Response.json({ success: false })],
    ['turnstile-response', 'turnstile-secret', new Response('unavailable', { status: 503 })],
  ])('fails closed when Turnstile cannot verify a token', async (token, secret, response) => {
    await expect(verifyTurnstile(token, secret, async () => response)).rejects.toThrow('Turnstile verification failed')
  })

  it.each([
    [{ success: true, hostname: 'preview.nanamicat.pages.dev' }, {}],
    [{ success: true, hostname: 'nanamicat.com', action: 'write' }, { expectedAction: 'react' }],
  ])('fails closed when Turnstile hostname or configured action does not match', async (payload, options) => {
    await expect(verifyTurnstile('turnstile-response', 'turnstile-secret', {
      ...options,
      fetchImplementation: async () => Response.json(payload),
    })).rejects.toThrow('Turnstile verification failed')
  })

  it('accepts a configured hostname and action only when both match Siteverify', async () => {
    await expect(verifyTurnstile('turnstile-response', 'turnstile-secret', {
      expectedHostname: 'preview.nanamicat.pages.dev',
      expectedAction: 'guestbook-write',
      fetchImplementation: async () => Response.json({
        success: true,
        hostname: 'preview.nanamicat.pages.dev',
        action: 'guestbook-write',
      }),
    })).resolves.toBeUndefined()
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

  it('atomically commits a photo entry while clearing its prior cleanup intent', async () => {
    const queries: Query[] = []
    const statement = (sql: string, values: unknown[] = []) => ({
      sql,
      values,
      bind: (...bound: unknown[]) => statement(sql, bound),
    })
    const db = {
      prepare: (sql: string) => statement(sql),
      batch: async (statements: unknown[]) => {
        for (const raw of statements) {
          const query = raw as Query
          queries.push(query)
        }
        return []
      },
    }

    const entry = await createGuestbookPhotoEntry(envWith(db), {
      id: 'entry-photo', nickname: 'Momo', message: 'Hello', emoji: '🐾',
      photoKey: 'pending/entry-photo.webp', photoStatus: 'pending', now: 1_700_000_000_000,
    })

    expect(entry.photo_status).toBe('pending')
    expect(queries).toEqual([
      expect.objectContaining({ sql: expect.stringContaining('INSERT INTO guestbook_entries') }),
      expect.objectContaining({
        sql: 'DELETE FROM guestbook_photo_cleanup WHERE photo_key = ?',
        values: ['pending/entry-photo.webp'],
      }),
    ])
  })

  it('persists an explicit active reaction and aggregates it in one serialized D1 batch', async () => {
    const { db, queries } = makeReactionDb()

    await expect(setGuestbookReaction(envWith(db), {
      entryId: 'entry-1',
      visitorHash: 'hmac-visitor-only',
      emoji: '🐾',
      active: true,
      now: 1_700_000_000_000,
    })).resolves.toEqual({ active: true, total: 1 })

    expect(queries).toEqual([
      expect.objectContaining({ sql: expect.stringContaining('WHERE id = ? AND hidden = 0') }),
      expect.objectContaining({ sql: expect.stringContaining('ON CONFLICT(entry_id, visitor_hash, emoji) DO NOTHING') }),
      expect.objectContaining({ sql: expect.stringContaining('COUNT(*) AS total') }),
    ])
  })

  it('makes concurrent or retried requested states idempotent with consistent active/count pairs', async () => {
    const { db } = makeReactionDb()
    const input = {
      entryId: 'entry-1',
      visitorHash: 'hmac-visitor-only',
      emoji: '🖤' as const,
      active: true,
      now: 1_700_000_000_000,
    }

    await expect(Promise.all([
      setGuestbookReaction(envWith(db), input),
      setGuestbookReaction(envWith(db), input),
    ])).resolves.toEqual([
      { active: true, total: 1 },
      { active: true, total: 1 },
    ])

    await expect(setGuestbookReaction(envWith(db), { ...input, active: false })).resolves.toEqual({ active: false, total: 0 })
  })
})
