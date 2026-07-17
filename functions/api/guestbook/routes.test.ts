import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_MULTIPART_REQUEST_BYTES,
  onRequestGet as listGuestbook,
  onRequestPost as createGuestbook,
  readBoundedMultipartRequest,
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
  photoBatchFailure?: 'before' | 'after'
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
      batch: async (rawStatements: unknown[]) => {
        const isPhotoEntryBatch = rawStatements.some((raw) => (raw as Query).sql.includes('INSERT INTO guestbook_entries'))
        if (isPhotoEntryBatch && options.photoBatchFailure === 'before') {
          throw new Error('D1 photo entry batch result unavailable')
        }

        const results = rawStatements.map((raw) => {
          const query = raw as Query
          queries.push(query)
          if (query.sql.includes('SELECT id FROM guestbook_entries')) {
            return { results: [{ id: String(query.values[0]) }], success: true, meta: {} }
          }
          if (query.sql.includes('INSERT INTO guestbook_entries')) {
            entries.push({
              id: String(query.values[0]),
              nickname: String(query.values[1]),
              message: String(query.values[2]),
              entry_emoji: typeof query.values[3] === 'string' ? query.values[3] : null,
              photo_key: typeof query.values[4] === 'string' ? query.values[4] : null,
              photo_status: query.values[5] as GuestbookRow['photo_status'],
              hidden: 0,
              created_at: Number(query.values[6]),
            })
            return { results: [], success: true, meta: { changes: 1 } }
          }
          if (query.sql.includes('DELETE FROM guestbook_photo_cleanup')) {
            return { results: [], success: true, meta: { changes: 1 } }
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
        })

        if (isPhotoEntryBatch && options.photoBatchFailure === 'after') {
          throw new Error('D1 photo entry batch response lost after commit')
        }

        return results
      },
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
    TURNSTILE_EXPECTED_HOSTNAMES: 'nanamicat.com,www.nanamicat.com,nanami-digital-museum.pages.dev',
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

function entryRequest(
  fields: Record<string, string>,
  photo?: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> },
  clientIp: string | null = '203.0.113.44',
): Request {
  const headers = new Headers({ 'content-type': 'multipart/form-data; boundary=test-boundary' })
  if (clientIp !== null) {
    headers.set('cf-connecting-ip', clientIp)
  }
  const request = new Request('https://nanamicat.com/api/guestbook', {
    method: 'POST',
    headers,
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
    const storedKey = (put.mock.calls as unknown as Array<[string]>)[0]?.[0]
    const intentInsert = db.queries.find(({ sql }) => sql.includes('INSERT INTO guestbook_photo_cleanup'))
    expect(intentInsert?.values[0]).toBe(storedKey)
    expect(db.queries).toContainEqual(expect.objectContaining({
      sql: 'DELETE FROM guestbook_photo_cleanup WHERE photo_key = ?',
      values: [storedKey],
    }))
    expect(sanitizer.fetch).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      headers: expect.any(Headers),
    }))
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    await expect(response.json()).resolves.toMatchObject({ photoStatus: 'pending', photoUrl: null })
  })

  it('retains the durable cleanup intent when an ambiguous R2 put cannot be immediately deleted', async () => {
    const db = makeDb()
    const put = vi.fn(async () => { throw new Error('R2 write outcome unknown') })
    const remove = vi.fn(async () => { throw new Error('R2 delete outcome unknown') })
    const sanitizer = { fetch: vi.fn(async () => new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    })) }
    vi.stubGlobal('fetch', successfulTurnstile())
    const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01])
    const photo = {
      name: 'nanami.jpg', type: 'image/jpeg', size: photoBytes.byteLength,
      arrayBuffer: async () => photoBytes.buffer.slice(0),
    }

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: 'Momo', message: 'Hello', emoji: '', 'cf-turnstile-response': 'valid-token',
    }, photo), makeEnv({
      db: db.db,
      sanitizer: sanitizer as unknown as Fetcher,
      photos: { put, delete: remove } as unknown as R2Bucket,
    })))

    expect(response.status).toBe(500)
    expect(remove).toHaveBeenCalledWith(expect.stringMatching(/^pending\/.+\.webp$/))
    expect(db.queries).toContainEqual(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO guestbook_photo_cleanup'),
    }))
    expect(db.queries).not.toContainEqual(expect.objectContaining({
      sql: 'DELETE FROM guestbook_photo_cleanup WHERE photo_key = ?',
    }))
    expect(db.entries).toEqual([])
  })

  it('does not delete R2 when a photo-entry batch response is lost after the entry commit', async () => {
    const db = makeDb({ photoBatchFailure: 'after' })
    const put = vi.fn(async () => null)
    const remove = vi.fn(async () => undefined)
    const sanitizer = { fetch: vi.fn(async () => new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    })) }
    vi.stubGlobal('fetch', successfulTurnstile())
    const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01])
    const photo = {
      name: 'nanami.jpg', type: 'image/jpeg', size: photoBytes.byteLength,
      arrayBuffer: async () => photoBytes.buffer.slice(0),
    }

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: 'Momo', message: 'Hello', emoji: '', 'cf-turnstile-response': 'valid-token',
    }, photo), makeEnv({
      db: db.db,
      sanitizer: sanitizer as unknown as Fetcher,
      photos: { put, delete: remove } as unknown as R2Bucket,
    })))

    expect(response.status).toBe(500)
    expect(db.entries).toHaveLength(1)
    expect(remove).not.toHaveBeenCalled()
  })

  it('leaves the cleanup intent for the private cleaner when photo entry commit cannot be confirmed', async () => {
    const db = makeDb({ photoBatchFailure: 'before' })
    const put = vi.fn(async () => null)
    const remove = vi.fn(async () => undefined)
    const sanitizer = { fetch: vi.fn(async () => new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    })) }
    vi.stubGlobal('fetch', successfulTurnstile())
    const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01])
    const photo = {
      name: 'nanami.jpg', type: 'image/jpeg', size: photoBytes.byteLength,
      arrayBuffer: async () => photoBytes.buffer.slice(0),
    }

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: 'Momo', message: 'Hello', emoji: '', 'cf-turnstile-response': 'valid-token',
    }, photo), makeEnv({
      db: db.db,
      sanitizer: sanitizer as unknown as Fetcher,
      photos: { put, delete: remove } as unknown as R2Bucket,
    })))

    expect(response.status).toBe(500)
    expect(db.entries).toEqual([])
    expect(remove).not.toHaveBeenCalled()
    expect(db.queries).toContainEqual(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO guestbook_photo_cleanup'),
    }))
    expect(db.queries).not.toContainEqual(expect.objectContaining({
      sql: 'DELETE FROM guestbook_photo_cleanup WHERE photo_key = ?',
    }))
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
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(db.queries.filter(({ sql }) => sql.includes('INSERT INTO guestbook_rate_events'))).toHaveLength(1)
  })

  it('shares the server HMAC rate bucket across repeated cookie-less writes', async () => {
    const db = makeDb({ rateChanges: [1, 1, 1, 1, 1, 1, 0] })
    vi.stubGlobal('fetch', successfulTurnstile())

    const responses: Response[] = []
    for (let index = 0; index < 4; index += 1) {
      responses.push(await createGuestbook(pagesContext(entryRequest({
        nickname: 'Momo', message: 'Hello', emoji: '', 'cf-turnstile-response': 'valid-token',
      }), makeEnv({ db: db.db }))))
    }

    expect(responses.map(({ status }) => status)).toEqual([201, 201, 201, 429])
    expect(db.entries).toHaveLength(3)
    const rateInsertions = db.queries.filter(({ sql }) => sql.includes('INSERT INTO guestbook_rate_events'))
    const ipFingerprints = rateInsertions.filter((_, index) => index % 2 === 0).map(({ values }) => values[0])
    const cookieFingerprints = rateInsertions.filter((_, index) => index % 2 === 1).map(({ values }) => values[0])
    expect(rateInsertions).toHaveLength(7)
    expect(new Set(ipFingerprints)).toEqual(new Set([ipFingerprints[0]]))
    expect(new Set(cookieFingerprints)).toHaveLength(3)
    expect(db.queries.flatMap(({ values }) => values)).not.toContain('203.0.113.44')
  })

  it('fails safely before Turnstile when Cloudflare does not provide CF-Connecting-IP', async () => {
    const db = makeDb()
    const turnstile = successfulTurnstile()
    vi.stubGlobal('fetch', turnstile)

    const response = await createGuestbook(pagesContext(entryRequest({
      nickname: 'Momo', message: 'Hello', emoji: '', 'cf-turnstile-response': 'valid-token',
    }, undefined, null), makeEnv({ db: db.db })))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Guestbook write protection is unavailable. Please try again later.' })
    expect(turnstile).not.toHaveBeenCalled()
    expect(db.entries).toEqual([])
  })

  it.each([null, 'not-a-number'])('bounds multipart bytes before form parsing when Content-Length is %s', async (contentLength) => {
    const formData = vi.fn()
    const turnstile = successfulTurnstile()
    vi.stubGlobal('fetch', turnstile)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_MULTIPART_REQUEST_BYTES + 1))
        controller.close()
      },
    })
    const headers = new Headers({ 'content-type': 'multipart/form-data; boundary=test-boundary' })
    if (contentLength !== null) {
      headers.set('content-length', contentLength)
    }
    const request = {
      url: 'https://nanamicat.com/api/guestbook',
      method: 'POST',
      headers,
      body,
      formData,
    } as unknown as Request

    const response = await createGuestbook(pagesContext(request, makeEnv({ db: makeDb().db })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Guestbook upload is too large' })
    expect(formData).not.toHaveBeenCalled()
    expect(turnstile).not.toHaveBeenCalled()
  })

  it('rejects an oversized declared multipart body before reading its stream', async () => {
    const getReader = vi.fn(() => ({ read: vi.fn() }))
    const request = {
      url: 'https://nanamicat.com/api/guestbook',
      method: 'POST',
      headers: new Headers({
        'content-type': 'multipart/form-data; boundary=test-boundary',
        'content-length': String(MAX_MULTIPART_REQUEST_BYTES + 1),
      }),
      body: { getReader },
    } as unknown as Request

    await expect(readBoundedMultipartRequest(request)).rejects.toThrow('Guestbook upload is too large')
    expect(getReader).not.toHaveBeenCalled()
  })

  it('sets exactly the requested reaction state after Turnstile verification', async () => {
    const db = makeDb()
    vi.stubGlobal('fetch', successfulTurnstile())
    const request = new Request('https://nanamicat.com/api/guestbook/entry-1/reactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.44' },
      body: JSON.stringify({ emoji: '🖤', active: true, 'cf-turnstile-response': 'valid-token' }),
    })

    const response = await setReaction(pagesContext(request, makeEnv({ db: db.db }), { id: 'entry-1' }))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    await expect(response.json()).resolves.toEqual({ entryId: 'entry-1', emoji: '🖤', active: true, total: 1 })
  })

  it('blocks a reaction on the server rate bucket before creating a visitor cookie bucket', async () => {
    const db = makeDb({ rateChanges: [0] })
    vi.stubGlobal('fetch', successfulTurnstile())
    const request = new Request('https://nanamicat.com/api/guestbook/entry-1/reactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.44' },
      body: JSON.stringify({ emoji: '🖤', active: true, 'cf-turnstile-response': 'valid-token' }),
    })

    const response = await setReaction(pagesContext(request, makeEnv({ db: db.db }), { id: 'entry-1' }))

    expect(response.status).toBe(429)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(db.queries.filter(({ sql }) => sql.includes('INSERT INTO guestbook_rate_events'))).toHaveLength(1)
  })

  it.each([
    [{ emoji: '🔥', active: true, 'cf-turnstile-response': 'valid-token' }, 400],
    [{ emoji: '🐾', active: 'yes', 'cf-turnstile-response': 'valid-token' }, 400],
    [{ emoji: '🐾', active: true }, 403],
  ])('rejects malformed reaction input', async (body, expectedStatus) => {
    const db = makeDb()
    vi.stubGlobal('fetch', successfulTurnstile())
    const request = new Request('https://nanamicat.com/api/guestbook/entry-1/reactions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.44' }, body: JSON.stringify(body),
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
    expect(approvedResponse.headers.get('cache-control')).toBe('no-store')
    expect(get).toHaveBeenCalledWith('pending/approved.webp')
  })
})
