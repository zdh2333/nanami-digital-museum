import { guestbookLimits } from '../../../src/guestbook/contracts'

export const RATE_LIMIT_WINDOW_MS = guestbookLimits.rateWindowMs
export const ORPHAN_PHOTO_GRACE_MS = 15 * 60 * 1000
export const PENDING_PHOTO_PREFIX = 'pending/'

export interface GuestbookCleanerEnv {
  DB: D1Database
  PHOTOS: R2Bucket
}

export async function cleanupRateEvents(
  env: GuestbookCleanerEnv,
  scheduledTime: number,
): Promise<void> {
  await env.DB.prepare(
    'DELETE FROM guestbook_rate_events WHERE created_at < ?',
  ).bind(scheduledTime - RATE_LIMIT_WINDOW_MS).run()
}

async function photoIsReferenced(env: Pick<GuestbookCleanerEnv, 'DB'>, photoKey: string): Promise<boolean> {
  const entry = await env.DB.prepare(
    'SELECT id FROM guestbook_entries WHERE photo_key = ? LIMIT 1',
  ).bind(photoKey).first<{ id: string }>()
  return entry !== null
}

async function clearPhotoIntent(env: Pick<GuestbookCleanerEnv, 'DB'>, photoKey: string): Promise<void> {
  await env.DB.prepare(
    'DELETE FROM guestbook_photo_cleanup WHERE photo_key = ?',
  ).bind(photoKey).run()
}

async function deleteUnreferencedPhoto(
  env: GuestbookCleanerEnv,
  photoKey: string,
  processed: Set<string>,
): Promise<void> {
  if (processed.has(photoKey) || await photoIsReferenced(env, photoKey)) {
    return
  }

  await env.PHOTOS.delete(photoKey)
  await clearPhotoIntent(env, photoKey)
  processed.add(photoKey)
}

/**
 * Sweeps two independently recoverable sources of pending-photo orphans:
 * durable intents created before R2 writes and old R2 objects that are no
 * longer referenced by an entry. The grace window protects in-flight writes.
 */
export async function cleanupGuestbookPhotoOrphans(
  env: GuestbookCleanerEnv,
  scheduledTime: number,
): Promise<void> {
  const cutoff = scheduledTime - ORPHAN_PHOTO_GRACE_MS
  const processed = new Set<string>()
  const intents = await env.DB.prepare(
    'SELECT photo_key FROM guestbook_photo_cleanup WHERE created_at < ? ORDER BY created_at ASC LIMIT 1000',
  ).bind(cutoff).all<{ photo_key: string }>()

  for (const intent of intents.results ?? []) {
    if (typeof intent.photo_key !== 'string' || !intent.photo_key.startsWith(PENDING_PHOTO_PREFIX)) {
      continue
    }

    if (await photoIsReferenced(env, intent.photo_key)) {
      await clearPhotoIntent(env, intent.photo_key)
      processed.add(intent.photo_key)
      continue
    }

    await deleteUnreferencedPhoto(env, intent.photo_key, processed)
  }

  let cursor: string | undefined
  do {
    const page = await env.PHOTOS.list({ prefix: PENDING_PHOTO_PREFIX, limit: 1000, cursor })
    for (const object of page.objects) {
      if (object.uploaded.getTime() >= cutoff) {
        continue
      }
      await deleteUnreferencedPhoto(env, object.key, processed)
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor !== undefined)
}

export async function cleanupGuestbookArtifacts(
  env: GuestbookCleanerEnv,
  scheduledTime: number,
): Promise<void> {
  await cleanupRateEvents(env, scheduledTime)
  await cleanupGuestbookPhotoOrphans(env, scheduledTime)
}

export default {
  scheduled(controller, env, context) {
    context.waitUntil(cleanupGuestbookArtifacts(env, controller.scheduledTime))
  },
} satisfies ExportedHandler<GuestbookCleanerEnv>
