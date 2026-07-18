import type { GuestbookEmoji } from './contracts'

export type GuestbookPhotoStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface GuestbookReaction {
  emoji: GuestbookEmoji
  total: number
}

export interface GuestbookEntry {
  id: string
  nickname: string
  message: string
  emoji: GuestbookEmoji | null
  createdAt: number
  photoUrl: string | null
  reactions: GuestbookReaction[]
}

export interface GuestbookPage {
  entries: GuestbookEntry[]
  nextCursor: string | null
}

export interface CreatedGuestbookEntry {
  entry: GuestbookEntry
  photoStatus: GuestbookPhotoStatus
  photoUrl: string | null
}

export interface ReactionResult {
  entryId: string
  emoji: GuestbookEmoji
  active: boolean
  total: number
}

export class GuestbookApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'GuestbookApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new GuestbookApiError('Guestbook is temporarily unavailable. Please try again later.', response.status)
  }

  if (!isRecord(payload)) {
    throw new GuestbookApiError('Guestbook is temporarily unavailable. Please try again later.', response.status)
  }

  if (!response.ok) {
    const message = typeof payload.error === 'string'
      ? payload.error
      : 'Guestbook is temporarily unavailable. Please try again later.'
    throw new GuestbookApiError(message, response.status)
  }

  return payload
}

function isEmoji(value: unknown): value is GuestbookEmoji {
  return value === '🐈‍⬛' || value === '🖤' || value === '🐾' || value === '😺' || value === '✨'
}

function parseEntry(value: unknown): GuestbookEntry {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.nickname !== 'string'
    || typeof value.message !== 'string'
    || (value.emoji !== null && !isEmoji(value.emoji))
    || typeof value.createdAt !== 'number'
    || (value.photoUrl !== null && typeof value.photoUrl !== 'string')
    || !Array.isArray(value.reactions)
  ) {
    throw new GuestbookApiError('Guestbook returned an invalid entry.', 502)
  }

  const reactions = value.reactions.flatMap((reaction) => {
    if (
      !isRecord(reaction)
      || !isEmoji(reaction.emoji)
      || typeof reaction.total !== 'number'
      || !Number.isSafeInteger(reaction.total)
      || reaction.total < 1
    ) {
      return []
    }
    return [{ emoji: reaction.emoji, total: reaction.total }]
  })

  return {
    id: value.id,
    nickname: value.nickname,
    message: value.message,
    emoji: value.emoji,
    createdAt: value.createdAt,
    photoUrl: value.photoUrl,
    reactions,
  }
}

function parsePage(payload: Record<string, unknown>): GuestbookPage {
  if (!Array.isArray(payload.entries) || (payload.nextCursor !== null && typeof payload.nextCursor !== 'string')) {
    throw new GuestbookApiError('Guestbook returned an invalid page.', 502)
  }

  return { entries: payload.entries.map(parseEntry), nextCursor: payload.nextCursor }
}

export async function fetchGuestbook(cursor?: string, signal?: AbortSignal): Promise<GuestbookPage> {
  const url = cursor === undefined
    ? '/api/guestbook'
    : `/api/guestbook?cursor=${encodeURIComponent(cursor)}`
  const payload = await readJson(await fetch(url, {
    headers: { accept: 'application/json' },
    signal,
  }))
  return parsePage(payload)
}

export async function createGuestbookEntry(input: {
  nickname: string
  message: string
  emoji: GuestbookEmoji | ''
  photo: File | null
}): Promise<CreatedGuestbookEntry> {
  const body = new FormData()
  body.set('nickname', input.nickname)
  body.set('message', input.message)
  body.set('emoji', input.emoji)
  if (input.photo !== null) body.set('photo', input.photo)

  const payload = await readJson(await fetch('/api/guestbook', {
    method: 'POST',
    headers: { accept: 'application/json' },
    body,
  }))
  const status = payload.photoStatus
  if (
    !('entry' in payload)
    || (status !== 'none' && status !== 'pending' && status !== 'approved' && status !== 'rejected')
    || (payload.photoUrl !== null && typeof payload.photoUrl !== 'string')
  ) {
    throw new GuestbookApiError('Guestbook returned an invalid entry.', 502)
  }

  return { entry: parseEntry(payload.entry), photoStatus: status, photoUrl: payload.photoUrl }
}

export async function toggleReaction(input: {
  entryId: string
  emoji: GuestbookEmoji
  active: boolean
}): Promise<ReactionResult> {
  const payload = await readJson(await fetch(`/api/guestbook/${encodeURIComponent(input.entryId)}/reactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      emoji: input.emoji,
      active: input.active,
    }),
  }))

  if (
    payload.entryId !== input.entryId
    || payload.emoji !== input.emoji
    || typeof payload.active !== 'boolean'
    || typeof payload.total !== 'number'
    || !Number.isSafeInteger(payload.total)
    || payload.total < 0
  ) {
    throw new GuestbookApiError('Guestbook returned an invalid reaction.', 502)
  }

  return { entryId: input.entryId, emoji: input.emoji, active: payload.active, total: payload.total }
}
