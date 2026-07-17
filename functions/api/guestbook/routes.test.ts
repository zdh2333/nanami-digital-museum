import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  onRequestGet as listGuestbook,
  onRequestPost as createGuestbook,
} from './index'
import { onRequestGet as getPhoto } from './photos/[id]'
import { onRequestPost as setReaction } from './[id]/reactions'
import type { GuestbookEnv } from '../../_lib/guestbook'

type Query = { sql: string; values: unknown[] }

type GuestbookRow = {
  id: string
  nickname: string
  message: string
  entry_emoji: string | null
  photo_key: string | null
  photo_status: 'none' | 'pending' | 'approved' | 'rejected'
  hidden: number
  created_at: number
}

function makeDb(options: {
  entries?: GuestbookRow[]
  rateChanges?: number[]
  photo?: { photo_key: string } | null
} = {}) {
  const queries: Query[] = []
  const entries = [...(options.entries ?? [])]
  const reactions = new Set<string>()
  let rateChangeIndex = 0

  const statement = (sql: string, values: unknown[] = []) => ({
    sql,
    values,
    bind: (...bound: unknown[]) => statement(sql, bound),
    all: async <T>() => {
      queries.push({ sql, values })
      if (sql.includes('FROM guestbook_entries')) {
        return { results: entries as T[], success: true, meta: {} }
      }
      if (sql.includes('FROM guestbook_reactions')) {
        return { results: [] as T[], success: true, meta: {} }
      }
      return { results: [] as T[], success: true, meta: {} }
    },
    first: async <T>() => {
      queries.push({ sql, values })
      return (options.photo ?? null) as T | null
    },
    run: async () => {
      queries.push({ sql, values })
      if (sql.includes('guestbook_rate_events')) {
        if (sql.includes('INSERT INTO')) {
          return { success: true, meta: { changes: options.rateChanges?.[rateChangeIndex++] ?? 1 } }
        }
        return { success: true, meta: { changes: 1 } }
      }
      if (sql.includes('INSERT INTO guestbook_entries')) {
        entries.push({
          id: String(values[0]),
          nickname: String(values[1]),
          message: String(values[2]),
          entry_emoji: typeof values[3] === 'string' ? values[3] : null,
          photo_key: typeof values[4] === 'string' ? values[4] : null,
          photo_status: values[5] as GuestbookRow['photo_status'],
          hidden: 0,
          created_at: Number(values[6]),
        })
      }
      return { success: true, meta: { changes: 1 } }
    },
  })

  return {
    db: {
      prepare: (sql: string) => statement(sql),
      batch: async (rawStatements: unknown[]) => rawStatements.map((raw) => {
        const query = raw as Query
        queries.push(query)
        if (query.sql.includes('SELECT id FROM guestbook_entries')) {
          return { results: [{ id: String(query.values[0]) }], success: true, meta: {} }
        }
        if (query.sql.includes('INSERT INTO guestbook_reactions')) {
          reactions.add(`${query.values[0]}:${query.values[1]}:${query.values[2]}`)
          return { results: [], success: true, meta: { changes: 1 } }
        }
        if (query.sql.includes('DELETE FROM guestbook_reactions')) {
          reactions.delete(`${query.values[0]}:${query.values[1]}:${query.values[2]}`)
          return { results: [], success: true, meta: { changes: 1 } }
        }
        if (query.sql.includes('COUNT(*) AS total')) {
          const total = [...reactions].filter((value) => value.endsWith(`:${query.values[1]}`)).length
          return { results: [{ total }], success: true, meta: {} }
        }
        throw new Error(`Unexpected D1 batch statement: ${query.sql}`)
      }),
    },
    entries,
    queries,
  }
}

function pagesContext<TParams extends string = never>(
  request: Request,
  env: GuestbookEnv,
  params: Record<TParams, string> = {} as Record<TParams, string>,
) {
  return {
    request,
    env,
    params,
    data: {},
    functionPath: new URL(request.url).pathname,
    next: async () => new Response('not used'),
    passThroughOnException: () => {},
    waitUntil: () => {},
  } as unknown as Parameters<PagesFunction<GuestbookEnv, TParams>>[0]
}

function makeEnv(options: {
  db?: ReturnType<typeof makeDb>['db']
  sanitizer?: Fetcher
  photos?: R2Bucket
} = {}): GuestbookEnv {
  return {
    DB: (options.db ?? makeDb().db) as unknown as D1Database,
    PHOTOS: (options.photos ?? { get: vi.fn(), put: vi.fn(), delete: vi.fn() }) as unknown as R2Bucket,
    IMAGE_SANITIZER: (options.sanitizer ?? { fetch: vi.fn() }) as unknown as Fetcher,
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    TURNSTILE_EXPECTED_HOSTNAME: 'nanamicat.com',
    TURNSTILE_EXPECTED_ACTION: 'guestbook-write',
    GUESTBOOK_HMAC_KEY: 'guestbook-hmac-secret',
  }
}

function successfulTurnstile() {
  return vi.fn(async () => Response.json({
    success: true,
    hostname: 'nanamicat.com',
    action: 'guestbook-write',
  }))
}

function entryRequest(fields: Record<string, string>, photo?: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }): Request {
  const request = new Request('https://nanamicat.com/api/guestbook', {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' },
  })
  const values: Record<string, FormDataEntryValue | null> = { ...fields }
  if (photo !== undefined) {
    values.photo = photo as unknown as File
  }
  Object.defineProperty(request, 'formData', {
    value: async () => ({ get: (name: string) => values[name] ?? null }),
  })
  return request
}

afterEach(() => vi.unstubAllGlobals())

describe('guestbook Pages Functions', () => {
  it('lists only public entries with no-store caching', async () => {
    const db = makeDb({ entries: [{
      id: 'entry-1', nickname: 'Momo', message: 'Hello Nanami', entry_emoji: '🐾',
      photo_key: null, photo_status: 'none', hidden: 0, created_at: 1_700_000_000_000,
    }] })
    const response = await listGuestbook(pagesContext(new Request('https://nanamicat.com/api/guestbook'), makeEnv({ db: db.db })))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      entries: [expect.objectContaining({ id: 'entry-1', photoUrl: null })],
      nextCursor: null,
    })
  })

  it('publishes text while keeping a transformed upload pending', async () => {
    const db = makeDb()
    const put = vi.fn(async () => null)
    const sanitizer = { fetch: vi.fn(async () => new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    })) }
    vi.stubGlobal('fetch', successfulTurnstile())
    const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01])
    const photo = {
      name: 'nanami.jpg',
      type: 'image/jpeg',
      size: photoBytes.byteLength,
      arrayBuffer: async () => photoBytes.buffer.slice(0),
    }

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: 'Momo', message: 'Hello 🐾', emoji: '🐾', 'cf-turnstile-response': 'valid-token',
    }, photo), makeEnv({ db: db.db, sanitizer: sanitizer as unknown as Fetcher, photos: { put } as unknown as R2Bucket })))

    expect(response.status).toBe(201)
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^pending\/.+\.webp$/), expect.any(ArrayBuffer), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'private, no-store' },
    })
    expect(sanitizer.fetch).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      headers: expect.any(Headers),
    }))
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    await expect(response.json()).resolves.toMatchObject({ photoStatus: 'pending', photoUrl: null })
  })

  it('returns a safe validation error before Turnstile or storage on malformed input', async () => {
    const db = makeDb()
    const turnstile = successfulTurnstile()
    vi.stubGlobal('fetch', turnstile)

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: '<b>Momo</b>', message: 'Hello', emoji: '', 'cf-turnstile-response': 'valid-token',
    }), makeEnv({ db: db.db })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Nickname contains markup' })
    expect(turnstile).not.toHaveBeenCalled()
    expect(db.entries).toEqual([])
  })

  it('rejects a forged cat-photo upload before Turnstile, rate tracking, or storage', async () => {
    const db = makeDb()
    const turnstile = successfulTurnstile()
    vi.stubGlobal('fetch', turnstile)
    const forgedBytes = new TextEncoder().encode('<svg><script>alert(1)</script></svg>')
    const forgedPhoto = {
      name: 'not-a-cat.png',
      type: 'image/png',
      size: forgedBytes.byteLength,
      arrayBuffer: async () => forgedBytes.buffer.slice(0),
    }

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: 'Momo', message: 'Hello', emoji: '', 'cf-turnstile-response': 'valid-token',
    }, forgedPhoto), makeEnv({ db: db.db })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Photo file signature is not allowed' })
    expect(turnstile).not.toHaveBeenCalled()
    expect(db.entries).toEqual([])
  })

  it('fails closed when Turnstile validation fails without creating an entry', async () => {
    const db = makeDb()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false })))

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: 'Momo', message: 'Hello', emoji: '', 'cf-turnstile-response': 'invalid-token',
    }), makeEnv({ db: db.db })))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Turnstile verification failed' })
    expect(db.entries).toEqual([])
  })

  it('blocks an entry after the rate limit has been reached', async () => {
    const db = makeDb({ rateChanges: [0] })
    vi.stubGlobal('fetch', successfulTurnstile())

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: 'Momo', message: 'Hello', emoji: '', 'cf-turnstile-response': 'valid-token',
    }), makeEnv({ db: db.db })))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'Too many guestbook actions. Please try again later.' })
    expect(db.entries).toEqual([])
  })

  it('sets exactly the requested reaction state after Turnstile verification', async () => {
    const db = makeDb()
    vi.stubGlobal('fetch', successfulTurnstile())
    const request = new Request('https://nanamicat.com/api/guestbook/entry-1/reactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emoji: '🖤', active: true, 'cf-turnstile-response': 'valid-token' }),
    })

    const response = await setReaction(pagesContext(request, makeEnv({ db: db.db }), { id: 'entry-1' }))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    await expect(response.json()).resolves.toEqual({ entryId: 'entry-1', emoji: '🖤', active: true, total: 1 })
  })

  it.each([
    [{ emoji: '🔥', active: true, 'cf-turnstile-response': 'valid-token' }, 400],
    [{ emoji: '🐾', active: 'yes', 'cf-turnstile-response': 'valid-token' }, 400],
    [{ emoji: '🐾', active: true }, 403],
  ])('rejects malformed reaction input', async (body, expectedStatus) => {
    const db = makeDb()
    vi.stubGlobal('fetch', successfulTurnstile())
    const request = new Request('https://nanamicat.com/api/guestbook/entry-1/reactions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })

    const response = await setReaction(pagesContext(request, makeEnv({ db: db.db }), { id: 'entry-1' }))

    expect(response.status).toBe(expectedStatus)
  })

  it('returns 404 for pending images and WebP only for approved images', async () => {
    const pendingDb = makeDb({ photo: null })
    const pendingResponse = await getPhoto(pagesContext(
      new Request('https://nanamicat.com/api/guestbook/pending/photos'),
      makeEnv({ db: pendingDb.db }),
      { id: 'pending' },
    ))
    expect(pendingResponse.status).toBe(404)

    const get = vi.fn(async () => ({ body: new ReadableStream(), writeHttpMetadata: () => {} }))
    const approvedDb = makeDb({ photo: { photo_key: 'pending/approved.webp' } })
    const approvedResponse = await getPhoto(pagesContext(
      new Request('https://nanamicat.com/api/guestbook/approved/photos'),
      makeEnv({ db: approvedDb.db, photos: { get } as unknown as R2Bucket }),
      { id: 'approved' },
    ))

    expect(approvedResponse.status).toBe(200)
    expect(approvedResponse.headers.get('content-type')).toBe('image/webp')
    expect(approvedResponse.headers.get('x-content-type-options')).toBe('nosniff')
    expect(approvedResponse.headers.get('cache-control')).toBe('public, max-age=86400')
    expect(get).toHaveBeenCalledWith('pending/approved.webp')
  })
})
