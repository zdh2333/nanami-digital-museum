import {
  createGuestbookEntry,
  createGuestbookPhotoEntry,
  createPhotoCleanupIntent,
  clearPhotoCleanupIntent,
  enforceRateLimit,
  getRateIdentity,
  getVisitor,
  listPublicGuestbookEntries,
  serializePublicEntry,
  verifyTurnstile,
  type GuestbookEnv,
  type GuestbookVisitor,
} from '../../_lib/guestbook'
import { guestbookError, guestbookJson, getTurnstileToken, turnstileOptions } from '../../_lib/http'
import { guestbookLimits } from '../../../src/guestbook/contracts'
import { GuestbookValidationError, parseEntryFields, validatePhoto } from '../../../src/guestbook/validation'

const MAX_SANITIZED_PHOTO_BYTES = 5 * 1024 * 1024
const MULTIPART_OVERHEAD_BYTES = 64 * 1024
export const MAX_MULTIPART_REQUEST_BYTES = guestbookLimits.photoMaxBytes + MULTIPART_OVERHEAD_BYTES

function optionalPhoto(value: FormDataEntryValue | null): File | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    if (value === '') {
      return null
    }
    throw new GuestbookValidationError('Photo must be a file')
  }

  if (
    typeof value !== 'object'
    || typeof value.name !== 'string'
    || typeof value.type !== 'string'
    || typeof value.size !== 'number'
    || typeof value.arrayBuffer !== 'function'
  ) {
    throw new GuestbookValidationError('Photo must be a file')
  }

  if (value.name === '' && value.size === 0) {
    return null
  }

  return value
}

async function parseEntryRequest(request: Request): Promise<{
  fields: ReturnType<typeof parseEntryFields>
  photo: File | null
  turnstileToken: unknown
}> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new GuestbookValidationError('Guestbook submissions must use form data')
  }

  let form: FormData
  try {
    form = await (await readBoundedMultipartRequest(request)).formData()
  } catch (error) {
    if (error instanceof GuestbookValidationError) {
      throw error
    }
    throw new GuestbookValidationError('Guestbook form data is invalid')
  }

  return {
    fields: parseEntryFields({
      nickname: form.get('nickname'),
      message: form.get('message'),
      emoji: form.get('emoji'),
    }),
    photo: optionalPhoto(form.get('photo')),
    turnstileToken: getTurnstileToken({
      'cf-turnstile-response': form.get('cf-turnstile-response'),
      turnstileToken: form.get('turnstileToken'),
    }),
  }
}

/**
 * Read multipart bytes into a fixed-size buffer before invoking formData().
 * Content-Length is merely an early rejection optimization; the stream cap is
 * authoritative for absent, misleading, or malformed headers.
 */
export async function readBoundedMultipartRequest(request: Request): Promise<Request> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null && /^(0|[1-9]\d*)$/.test(declaredLength)) {
    const length = Number(declaredLength)
    if (!Number.isSafeInteger(length) || length > MAX_MULTIPART_REQUEST_BYTES) {
      throw new GuestbookValidationError('Guestbook upload is too large')
    }
  }

  if (request.body === null) {
    return request
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      total += value.byteLength
      if (total > MAX_MULTIPART_REQUEST_BYTES) {
        throw new GuestbookValidationError('Guestbook upload is too large')
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof GuestbookValidationError) {
      throw error
    }
    throw new GuestbookValidationError('Guestbook upload could not be read')
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  const headers = new Headers(request.headers)
  headers.delete('content-length')
  return new Request(request.url, { method: request.method, headers, body })
}

interface PreparedPhoto {
  declaredMime: string
  bytes: ArrayBuffer
}

async function preparePhoto(photo: File): Promise<PreparedPhoto> {
  if (photo.size > guestbookLimits.photoMaxBytes) {
    throw new GuestbookValidationError('Photo exceeds the 5 MiB limit')
  }

  const bytes = await photo.arrayBuffer()
  validatePhoto({ declaredMime: photo.type, bytes: new Uint8Array(bytes), size: photo.size })

  return { declaredMime: photo.type, bytes }
}

async function sanitizePhoto(
  env: GuestbookEnv,
  photo: PreparedPhoto,
): Promise<ArrayBuffer> {
  let transformed: Response
  try {
    transformed = await env.IMAGE_SANITIZER.fetch(new Request('https://nanami-internal/sanitize', {
      method: 'POST',
      headers: {
        'x-nanami-internal': 'pages',
        'content-type': photo.declaredMime,
      },
      body: photo.bytes,
    }))
  } catch {
    throw new GuestbookValidationError('Cat photo could not be processed')
  }

  if (transformed.status !== 200 || transformed.headers.get('content-type')?.toLowerCase() !== 'image/webp') {
    throw new GuestbookValidationError('Cat photo could not be processed')
  }

  const sanitizedBytes = await transformed.arrayBuffer()
  if (sanitizedBytes.byteLength === 0 || sanitizedBytes.byteLength > MAX_SANITIZED_PHOTO_BYTES) {
    throw new GuestbookValidationError('Cat photo could not be processed')
  }

  return sanitizedBytes
}

async function storePendingPhoto(
  env: GuestbookEnv,
  photoKey: string,
  bytes: ArrayBuffer,
): Promise<void> {
  await env.PHOTOS.put(photoKey, bytes, {
    httpMetadata: {
      contentType: 'image/webp',
      cacheControl: 'private, no-store',
    },
  })
}

export const onRequestGet: PagesFunction<GuestbookEnv> = async (context) => {
  try {
    const cursor = new URL(context.request.url).searchParams.get('cursor')
    return guestbookJson(await listPublicGuestbookEntries(context.env, cursor), 200)
  } catch (error) {
    return guestbookError(error)
  }
}

export const onRequestPost: PagesFunction<GuestbookEnv> = async (context) => {
  let visitor: GuestbookVisitor | undefined
  let pendingPhotoKey: string | undefined
  let cleanupIntentPending = false

  try {
    const submission = await parseEntryRequest(context.request)
    const preparedPhoto = submission.photo === null ? null : await preparePhoto(submission.photo)
    const rateIdentity = await getRateIdentity(context.request, context.env.GUESTBOOK_HMAC_KEY)
    await verifyTurnstile(
      submission.turnstileToken,
      context.env.TURNSTILE_SECRET_KEY,
      turnstileOptions(context.env),
    )

    visitor = await getVisitor(context.request, context.env.GUESTBOOK_HMAC_KEY)
    await enforceRateLimit(context.env, {
      fingerprintHash: visitor.visitorHash,
      action: 'entry',
      now: Date.now(),
    })
    await enforceRateLimit(context.env, {
      fingerprintHash: rateIdentity,
      action: 'entry',
      now: Date.now(),
    })

    const now = Date.now()
    let photoKey: string | undefined
    if (preparedPhoto !== null) {
      const sanitizedPhoto = await sanitizePhoto(context.env, preparedPhoto)
      photoKey = `pending/${crypto.randomUUID()}.webp`
      pendingPhotoKey = photoKey
      await createPhotoCleanupIntent(context.env, photoKey, now)
      cleanupIntentPending = true
      await storePendingPhoto(context.env, photoKey, sanitizedPhoto)
    }

    const entryInput = {
      id: crypto.randomUUID(),
      nickname: submission.fields.nickname,
      message: submission.fields.message,
      emoji: submission.fields.emoji,
      photoKey,
      photoStatus: photoKey === undefined ? 'none' as const : 'pending' as const,
      now,
    }
    const entry = photoKey === undefined
      ? await createGuestbookEntry(context.env, entryInput)
      : await createGuestbookPhotoEntry(context.env, { ...entryInput, photoKey })
    cleanupIntentPending = false
    const publicEntry = serializePublicEntry(entry, [])

    return guestbookJson({
      entry: publicEntry,
      photoStatus: entry.photo_status,
      photoUrl: publicEntry.photoUrl,
    }, 201, visitor)
  } catch (error) {
    if (cleanupIntentPending && pendingPhotoKey !== undefined) {
      try {
        await context.env.PHOTOS.delete(pendingPhotoKey)
        await clearPhotoCleanupIntent(context.env, pendingPhotoKey)
      } catch {
        // Keep the durable intent so the scheduled private cleaner can retry.
      }
    }
    return guestbookError(error, visitor)
  }
}
