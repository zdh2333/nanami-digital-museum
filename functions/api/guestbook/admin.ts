+import {
  toEntryRecord,
  toReactionTotal,
  publicPhotoUrl,
  type GuestbookEnv,
  type GuestbookReactionTotal,
} from '../../_lib/guestbook'
import { guestbookError, guestbookJson } from '../../_lib/http'

const passwordEncoder = new TextEncoder()

async function passwordDigest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', passwordEncoder.encode(value)))
}

async function verifyAdmin(request: Request, env: GuestbookEnv): Promise<boolean> {
  const authorization = request.headers.get('Authorization')
  const expectedPassword = env.ADMIN_PASSWORD?.trim() ?? ''
  if (authorization === null || !authorization.startsWith('Bearer ') || expectedPassword === '') return false

  const suppliedPassword = authorization.slice('Bearer '.length).trim()
  const [suppliedDigest, expectedDigest] = await Promise.all([
    passwordDigest(suppliedPassword),
    passwordDigest(expectedPassword),
  ])
  let difference = 0
  for (let index = 0; index < suppliedDigest.length; index += 1) {
    difference |= suppliedDigest[index] ^ expectedDigest[index]
  }
  return difference === 0
}

export const onRequestGet: PagesFunction<GuestbookEnv> = async (context) => {
  if (!await verifyAdmin(context.request, context.env)) {
    return guestbookJson({ error: 'Unauthorized' }, 401)
  }

  try {
    const entryRows = await context.env.DB.prepare(
      `SELECT id, nickname, message, entry_emoji, photo_key, photo_status, hidden, created_at
       FROM guestbook_entries
       ORDER BY created_at DESC, id DESC`
    ).all<Record<string, unknown>>()

    const rows = (entryRows.results ?? []).map(toEntryRecord)

    const reactionsByEntry = new Map<string, GuestbookReactionTotal[]>()
    if (rows.length > 0) {
      const placeholders = rows.map(() => '?').join(', ')
      const reactionRows = await context.env.DB.prepare(
        `SELECT entry_id, emoji, COUNT(*) AS total
         FROM guestbook_reactions
         WHERE entry_id IN (${placeholders})
         GROUP BY entry_id, emoji`
      ).bind(...rows.map(({ id }) => id)).all<Record<string, unknown>>()

      for (const value of reactionRows.results ?? []) {
        const entryId = typeof value.entry_id === 'string' ? value.entry_id : ''
        const current = reactionsByEntry.get(entryId) ?? []
        current.push(toReactionTotal(value))
        reactionsByEntry.set(entryId, current)
      }
    }

    const entries = rows.map((entry) => ({
      id: entry.id,
      nickname: entry.nickname,
      message: entry.message,
      emoji: entry.entry_emoji,
      photoKey: entry.photo_key,
      photoStatus: entry.photo_status,
      hidden: entry.hidden,
      createdAt: entry.created_at,
      photoUrl: publicPhotoUrl(entry),
      reactions: (reactionsByEntry.get(entry.id) ?? []).map(({ emoji, total }) => ({ emoji, total })),
    }))

    return guestbookJson({ entries }, 200)
  } catch (error) {
    return guestbookError(error)
  }
}

export const onRequestPatch: PagesFunction<GuestbookEnv> = async (context) => {
  if (!await verifyAdmin(context.request, context.env)) {
    return guestbookJson({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload: any = await context.request.json()
    const { id, nickname, message, emoji, hidden, createdAt, photoStatus } = payload

    if (typeof id !== 'string' || id.trim() === '') {
      return guestbookJson({ error: 'ID is required' }, 400)
    }

    // Check if entry exists
    const existing = await context.env.DB.prepare(
      'SELECT id, nickname, message, entry_emoji, hidden, created_at, photo_status FROM guestbook_entries WHERE id = ?'
    ).bind(id).first<Record<string, unknown>>()

    if (existing === null) {
      return guestbookJson({ error: 'Entry not found' }, 404)
    }

    const updatedNickname = typeof nickname === 'string' ? nickname : String(existing.nickname)
    const updatedMessage = typeof message === 'string' ? message : String(existing.message)
    const updatedEmoji = emoji === null || typeof emoji === 'string' ? emoji : (existing.entry_emoji as string | null)
    const updatedHidden = typeof hidden === 'number' ? (hidden === 1 ? 1 : 0) : Number(existing.hidden)
    const updatedCreatedAt = typeof createdAt === 'number' ? createdAt : Number(existing.created_at)
    const updatedPhotoStatus = typeof photoStatus === 'string' ? photoStatus : String(existing.photo_status)

    await context.env.DB.prepare(
      `UPDATE guestbook_entries
       SET nickname = ?, message = ?, entry_emoji = ?, hidden = ?, created_at = ?, photo_status = ?
       WHERE id = ?`
    ).bind(
      updatedNickname,
      updatedMessage,
      updatedEmoji,
      updatedHidden,
      updatedCreatedAt,
      updatedPhotoStatus,
      id
    ).run()

    return guestbookJson({ success: true }, 200)
  } catch (error) {
    return guestbookError(error)
  }
}

export const onRequestDelete: PagesFunction<GuestbookEnv> = async (context) => {
  if (!await verifyAdmin(context.request, context.env)) {
    return guestbookJson({ error: 'Unauthorized' }, 401)
  }

  try {
    const id = new URL(context.request.url).searchParams.get('id')
    if (id === null || id.trim() === '') {
      return guestbookJson({ error: 'ID is required' }, 400)
    }

    await context.env.DB.prepare(
      'DELETE FROM guestbook_entries WHERE id = ?'
    ).bind(id).run()

    return guestbookJson({ success: true }, 200)
  } catch (error) {
    return guestbookError(error)
  }
}
