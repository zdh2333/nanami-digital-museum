import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GuestbookApiError,
  createGuestbookEntry,
  fetchGuestbook,
  toggleReaction,
} from './client'

const entry = {
  id: 'entry-1',
  nickname: 'Momo',
  message: 'Hello Nanami',
  emoji: '🐾' as const,
  createdAt: 1_700_000_000_000,
  photoUrl: null,
  reactions: [{ emoji: '🖤' as const, total: 2 }],
}

afterEach(() => vi.unstubAllGlobals())

describe('guestbook browser client', () => {
  it('loads a typed page and sends the opaque pagination cursor', async () => {
    const fetch = vi.fn(async () => Response.json({ entries: [entry], nextCursor: 'next-page' }))
    vi.stubGlobal('fetch', fetch)

    await expect(fetchGuestbook('older-page')).resolves.toEqual({
      entries: [entry],
      nextCursor: 'next-page',
    })
    expect(fetch).toHaveBeenCalledWith('/api/guestbook?cursor=older-page', {
      headers: { accept: 'application/json' },
      signal: undefined,
    })
  })

  it('posts a multipart entry and preserves the pending-photo result', async () => {
    const fetch = vi.fn(async () => Response.json({
      entry,
      photoStatus: 'pending',
      photoUrl: null,
    }, { status: 201 }))
    vi.stubGlobal('fetch', fetch)

    const photo = new File(['cat'], 'nanami.webp', { type: 'image/webp' })
    await expect(createGuestbookEntry({
      nickname: 'Momo', message: 'Hello Nanami', emoji: '🐾', photo, turnstileToken: 'token',
    })).resolves.toEqual({ entry, photoStatus: 'pending', photoUrl: null })

    const [, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('cf-turnstile-response')).toBe('token')
    expect((init.body as FormData).get('photo')).toBe(photo)
  })

  it('updates a desired reaction state and surfaces safe API errors', async () => {
    const fetch = vi.fn(async () => Response.json({
      entryId: 'entry-1', emoji: '🖤', active: true, total: 3,
    }))
    vi.stubGlobal('fetch', fetch)

    await expect(toggleReaction({
      entryId: 'entry-1', emoji: '🖤', active: true, turnstileToken: 'token',
    })).resolves.toEqual({ entryId: 'entry-1', emoji: '🖤', active: true, total: 3 })
    expect(fetch).toHaveBeenCalledWith('/api/guestbook/entry-1/reactions', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
    }))

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Turnstile verification failed' }, { status: 403 })))
    await expect(fetchGuestbook()).rejects.toEqual(new GuestbookApiError('Turnstile verification failed', 403))
  })
})
