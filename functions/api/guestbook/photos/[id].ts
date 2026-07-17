import { type GuestbookEnv } from '../../../_lib/guestbook'
import { guestbookError, validGuestbookEntryId } from '../../../_lib/http'

export const onRequestGet: PagesFunction<GuestbookEnv, 'id'> = async (context) => {
  try {
    const entryId = validGuestbookEntryId(context.params.id)
    const entry = await context.env.DB.prepare(
      `SELECT photo_key
       FROM guestbook_entries
       WHERE id = ? AND hidden = 0 AND photo_status = 'approved'`,
    ).bind(entryId).first<{ photo_key: string | null }>()

    if (entry?.photo_key === null || entry?.photo_key === undefined) {
      return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
    }

    const photo = await context.env.PHOTOS.get(entry.photo_key)
    if (photo === null) {
      return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
    }

    return new Response(photo.body, {
      status: 200,
      headers: {
        'content-type': 'image/webp',
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return guestbookError(error)
  }
}
